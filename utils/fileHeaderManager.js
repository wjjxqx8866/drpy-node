// fileHeaderManager.js
import fs from 'fs/promises';
import path from 'path';
import '../libs_drpy/_dist/json5.js';

class FileHeaderManager {
    static COMMENT_CONFIG = {
        '.js': {
            start: '/*',
            end: '*/',
            // 修改正则表达式，确保只匹配文件开头的注释块
            regex: /^(\s*\/\*[\s\S]*?\*\/)/,
            headerRegex: /@header\(([\s\S]*?)\)/,
            createComment: (content) => `/*\n${content}\n*/`,
            topCommentsRegex: /^(\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)+/
        },
        '.py': {
            start: '"""',
            end: '"""',
            // 修改正则表达式，确保只匹配文件开头的注释块
            regex: /^(\s*"""[\s\S]*?""")/,
            headerRegex: /@header\(([\s\S]*?)\)/,
            createComment: (content) => `"""\n${content}\n"""`,
            topCommentsRegex: /^(\s*(#[^\n]*\n|'''[\s\S]*?'''|"""[\s\S]*?""")\s*)+/
        },
        '.php': {
            start: '/*',
            end: '*/',
            // PHP 文件通常以 <?php 开头，注释块可能在 <?php 之后
            regex: /(<\?php\s*)?(\s*\/\*[\s\S]*?\*\/)/,
            headerRegex: /@header\(([\s\S]*?)\)/,
            createComment: (content) => `/*\n${content}\n*/`,
            topCommentsRegex: /(<\?php\s*)?(\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)+/
        }
    };


    /**
     * Find the @header(...) block in the comment text
     * @param {string} text Comment text
     * @param {string} ext File extension (.js or .py)
     * @returns {Object|null} { start, end, content }
     */
    static findHeaderBlock(text, ext) {
        const startMarker = '@header(';
        const startIndex = text.indexOf(startMarker);
        if (startIndex === -1) return null;

        let index = startIndex + startMarker.length;
        let balance = 1;
        let inString = false;
        let stringChar = '';
        let escape = false;
        let inLineComment = false;
        let inBlockComment = false;

        for (; index < text.length; index++) {
            const char = text[index];

            if (inLineComment) {
                if (char === '\n') inLineComment = false;
                continue;
            }

            if (inBlockComment) {
                if (char === '*' && text[index + 1] === '/') {
                    inBlockComment = false;
                    index++;
                }
                continue;
            }

            if (inString) {
                if (escape) {
                    escape = false;
                } else if (char === '\\') {
                    escape = true;
                } else if (char === stringChar) {
                    inString = false;
                }
                continue;
            }

            // Start of comment
            if (char === '/' && text[index + 1] === '/') {
                inLineComment = true;
                index++; 
            } else if (char === '/' && text[index + 1] === '*') {
                inBlockComment = true;
                index++;
            } else if (ext === '.py' && char === '#') {
                inLineComment = true;
            } else if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
            } else if (char === '(') {
                balance++;
            } else if (char === ')') {
                balance--;
                if (balance === 0) {
                    return {
                        start: startIndex,
                        end: index + 1,
                        content: text.substring(startIndex + startMarker.length, index)
                    };
                }
            }
        }
        return null;
    }

    /**
     * 解析对象字符串
     * @param {string} str 对象字符串
     * @returns {Object} 解析后的对象
     */
    static parseObjectLiteral(str) {
        try {
            return JSON5.parse(str);
        } catch (e) {
            // console.warn('JSON5 parse failed, falling back to eval:', e.message);
            try {
                // 尝试处理一些常见的非标准JSON格式
                // 1. 给未加引号的键加上引号 (简单的正则替换，不够完美但能处理大部分情况)
                // 注意：这里不再做简单的正则替换，因为 JSON5 已经能处理无引号键。
                // 如果 JSON5 失败，很可能是因为包含了函数或其他非数据类型，或者格式严重错误。
                
                // 为了兼容旧的非标准写法，保留 eval 方式作为最后的手段
                return (new Function(`return ${str}`))();
            } catch (evalError) {
                throw new Error(`Invalid header object: ${str}. Error: ${evalError.message}`);
            }
        }
    }

    /**
     * 读取文件头信息
     * @param {string} filePath 文件路径
     * @param {Object} [options] 配置选项
     * @param {number} [options.maxHeaderSize=8192] 最大读取字节数 (默认 8KB)
     * @returns {Object|null} 头信息对象
     */
    static async readHeader(filePath, options = {}) {
        const { maxHeaderSize = 8192 } = options;
        const ext = path.extname(filePath);
        const config = this.COMMENT_CONFIG[ext];

        if (!config) throw new Error(`Unsupported file type: ${ext}`);

        let content = '';
        let handle;
        
        try {
            // 使用 fs.open 和 read 读取部分内容，提高性能
            handle = await fs.open(filePath, 'r');
            const buffer = Buffer.alloc(maxHeaderSize);
            const { bytesRead } = await handle.read(buffer, 0, maxHeaderSize, 0);
            content = buffer.toString('utf8', 0, bytesRead);
        } catch (error) {
            // 如果读取失败 (如文件不存在)，抛出错误或返回 null
            if (handle) await handle.close();
            throw error;
        } finally {
            if (handle) await handle.close();
        }

        const match = content.match(config.regex);
        
        // 如果在头部没有找到匹配项，且文件可能很大，也许是注释太长被截断了？
        // 但目前假设 header 应该在 8KB 内。如果需要完整性，可以考虑 fallback 到读取整个文件，
        // 但为了性能，这里仅依赖前 8KB。
        if (!match) return null;

        const headerBlock = this.findHeaderBlock(match[0], ext);
        if (!headerBlock) return null;

        try {
            return this.parseObjectLiteral(headerBlock.content.trim());
        } catch {
            return null;
        }
    }

    /**
     * 创建文件备份
     * @param {string} filePath 原文件路径
     * @returns {string} 备份文件路径
     */
    static async createBackup(filePath) {
        const backupPath = `${filePath}.backup.${Date.now()}`;
        try {
            const content = await fs.readFile(filePath, 'utf8');
            await fs.writeFile(backupPath, content);
            return backupPath;
        } catch (error) {
            throw new Error(`Failed to create backup: ${error.message}`);
        }
    }

    /**
     * 从备份恢复文件
     * @param {string} filePath 目标文件路径
     * @param {string} backupPath 备份文件路径
     */
    static async restoreFromBackup(filePath, backupPath) {
        try {
            const backupContent = await fs.readFile(backupPath, 'utf8');
            await fs.writeFile(filePath, backupContent);
            // 删除备份文件
            await fs.unlink(backupPath);
        } catch (error) {
            throw new Error(`Failed to restore from backup: ${error.message}`);
        }
    }

    /**
     * 写入/更新文件头信息
     * @param {string} filePath 文件路径
     * @param {Object} headerObj 头信息对象
     * @param {Object} [options] 配置选项
     * @param {boolean} [options.createBackup=true] 是否创建备份
     */
    static async writeHeader(filePath, headerObj, options = {}) {
        const {createBackup = false} = options;
        // 添加参数验证
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path');
        }
        if (!headerObj || typeof headerObj !== 'object') {
            throw new Error('Invalid header object');
        }

        let content;
        try {
            content = await fs.readFile(filePath, 'utf8');
        } catch (error) {
            throw new Error(`Failed to read file: ${error.message}`);
        }

        // 备份原始内容
        const originalContent = content;
        const ext = path.extname(filePath);
        const config = this.COMMENT_CONFIG[ext];

        if (!config) throw new Error(`Unsupported file type: ${ext}`);

        const headerStr = `@header(${JSON5.stringify(headerObj, null, 2)})`;

        const match = content.match(config.regex);
        let newContent;

        if (match) {
            const [fullComment] = match;
            const commentStartIndex = content.indexOf(fullComment);
            const commentEndIndex = commentStartIndex + fullComment.length;

            // 确保匹配的注释块确实在文件开头（允许前面有空白字符）
            const beforeComment = content.substring(0, commentStartIndex);
            
            // 针对 PHP 特殊处理：忽略开头的 <?php 
            const isEffectiveStart = beforeComment.trim() === '' || (ext === '.php' && beforeComment.trim() === '<?php');

            if (!isEffectiveStart) {
                // 如果注释块前面有非空白内容（且不是允许的PHP标签），说明这不是文件头注释，创建新的头注释
                let newComment = config.createComment(headerStr) + '\n\n';
                
                if (ext === '.php') {
                    if (content.trim().startsWith('<?php')) {
                        newContent = content.replace(/<\?php\s*/, `<?php\n\n${newComment.trim()}\n\n`);
                    } else {
                        newContent = `<?php\n\n${newComment.trim()}\n\n` + content;
                    }
                } else {
                    newContent = newComment + content;
                }
            } else {
                // 这是文件头注释，进行更新
                const headerBlock = this.findHeaderBlock(fullComment, ext);
                
                if (headerBlock) {
                    // 已存在@header，替换它
                    const updatedComment = fullComment.substring(0, headerBlock.start) +
                        headerStr +
                        fullComment.substring(headerBlock.end);
                    newContent = content.substring(0, commentStartIndex) +
                        updatedComment +
                        content.substring(commentEndIndex);
                } else {
                    // 不存在@header，添加到注释块中
                    // 对于 PHP 文件，需要特别处理，确保注释闭合符 */ 在最后
                    const trimmedComment = fullComment.trim();
                    let updatedComment;
                    
                    if (ext === '.php' && trimmedComment.startsWith('<?php')) {
                        // 处理 <?php 开头的 PHP 文件注释
                        // 这里的 fullComment 包含了 <?php 和随后的注释块
                        // 我们需要找到注释的结束位置
                        const endMarker = config.end;
                        const lastIndex = fullComment.lastIndexOf(endMarker);
                        
                        if (lastIndex !== -1) {
                             updatedComment = fullComment.substring(0, lastIndex).trim() 
                                + `\n${headerStr}\n${endMarker}` 
                                + fullComment.substring(lastIndex + endMarker.length);
                        } else {
                            // 异常情况，直接追加
                            updatedComment = fullComment + `\n${config.createComment(headerStr)}`;
                        }
                    } else {
                         updatedComment = fullComment
                            .replace(config.end, '')
                            .trim()
                        + `\n${headerStr}\n${config.end}`;
                    }

                    newContent = content.substring(0, commentStartIndex) +
                        updatedComment +
                        content.substring(commentEndIndex);
                }
            }
        } else {
            // 没有找到注释块，在文件开头创建新的
            let newComment = config.createComment(headerStr) + '\n\n';
            
            // PHP 特殊处理：确保 <?php 在最前面
            if (ext === '.php') {
                if (content.trim().startsWith('<?php')) {
                    // 如果文件已经以 <?php 开头，把注释插到 <?php 后面
                    newContent = content.replace(/<\?php\s*/, `<?php\n\n${newComment.trim()}\n\n`);
                } else {
                    // 如果没有 <?php (可能是纯 HTML 混编? 或者短标签?) 
                    // 假设用户想要标准的 PHP 文件头
                    newContent = `<?php\n\n${newComment.trim()}\n\n` + content;
                }
            } else {
                newContent = newComment + content;
            }
        }

        // 确保新内容不只包含文件头
        const contentWithoutHeader = newContent.replace(config.regex, '').trim();
        if (!contentWithoutHeader) {
            throw new Error('写入失败：内容不能只包含文件头而无原始内容');
        }

        // 验证新内容不为空且包含原始内容的主要部分
        if (!newContent || newContent.trim().length === 0) {
            throw new Error('Generated content is empty, operation aborted');
        }

        // 简单的内容完整性检查：确保新内容包含原始内容的大部分非注释代码
        const originalCodeLines = originalContent.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') &&
                !trimmed.startsWith('*') && !trimmed.startsWith('*/') &&
                !trimmed.startsWith('#') && !trimmed.startsWith('"""') && !trimmed.startsWith("'''") &&
                !trimmed.startsWith('<?php');
        });

        const newCodeLines = newContent.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') &&
                !trimmed.startsWith('*') && !trimmed.startsWith('*/') &&
                !trimmed.startsWith('#') && !trimmed.startsWith('"""') && !trimmed.startsWith("'''") &&
                !trimmed.startsWith('<?php') && !trimmed.includes('@header(');
        });

        // 如果新内容的代码行数比原始内容少了很多，可能出现了问题
        if (originalCodeLines.length > 5 && newCodeLines.length < originalCodeLines.length * 0.8) {
            throw new Error('Content integrity check failed: significant code loss detected, operation aborted');
        }

        // 创建备份（如果启用）
        let backupPath = null;
        if (createBackup) {
            try {
                backupPath = await this.createBackup(filePath);
            } catch (error) {
                console.warn(`Warning: Failed to create backup for ${filePath}: ${error.message}`);
            }
        }

        try {
            await fs.writeFile(filePath, newContent);

            // 写入成功后，删除备份文件
            if (backupPath) {
                try {
                    await fs.unlink(backupPath);
                } catch (error) {
                    console.warn(`Warning: Failed to delete backup file ${backupPath}: ${error.message}`);
                }
            }
        } catch (error) {
            // 写入失败，尝试从备份恢复
            if (backupPath) {
                try {
                    await this.restoreFromBackup(filePath, backupPath);
                    console.log(`File restored from backup: ${filePath}`);
                } catch (restoreError) {
                    console.error(`Failed to restore from backup: ${restoreError.message}`);
                }
            }
            throw new Error(`Failed to write file: ${error.message}`);
        }
    }

    /**
     * 移除头信息区域
     * @param {string} input 文件路径或文件内容
     * @param {Object} [options] 配置选项
     * @param {string} [options.mode='header-only'] 移除模式:
     *   - 'header-only': 只移除@header行（默认）
     *   - 'top-comments': 移除文件顶部所有连续注释块
     * @param {string} [options.fileType] 文件类型（当input为内容时必需）
     * @returns {Promise<string>|string} 移除头信息后的内容
     */
    static async removeHeader(input, options = {}) {
        const {mode = 'header-only', fileType} = options;

        // 判断输入类型：文件路径 or 文件内容
        const isFilePath = !input.includes('\n') && input.length < 256 &&
            (input.endsWith('.js') || input.endsWith('.py'));

        let content, ext;

        if (isFilePath) {
            content = await fs.readFile(input, 'utf8');
            ext = path.extname(input);
        } else {
            content = input;
            ext = fileType ? `.${fileType.replace(/^\./, '')}` : null;

            if (!ext) {
                throw new Error('fileType option is required when input is content');
            }
        }

        const config = this.COMMENT_CONFIG[ext];
        if (!config) throw new Error(`Unsupported file type: ${ext}`);

        // 模式1: 移除顶部所有连续注释块
        if (mode === 'top-comments') {
            const match = content.match(config.topCommentsRegex);
            if (match) {
                content = content.substring(match[0].length);
            }
            return content.trim();
        }

        // 模式2: 只移除@header行（默认模式）
        const match = content.match(config.regex);
        if (!match) return content.trim();

        let [fullComment] = match;

        const headerBlock = this.findHeaderBlock(fullComment, ext);
        
        if (headerBlock) {
            // 获取 header 之前和之后的内容
            let beforeHeader = fullComment.substring(0, headerBlock.start);
            let afterHeader = fullComment.substring(headerBlock.end);
            
            // 移除注释开始符和结束符
            beforeHeader = beforeHeader.replace(config.start, '');
            afterHeader = afterHeader.replace(config.end, '');
            
            // PHP: 如果是 <?php 开头，清理掉 <?php
            if (ext === '.php') {
                beforeHeader = beforeHeader.replace(/<\?php\s*/, '');
            }
            
            // 合并并清理
            let cleanedInner = (beforeHeader + '\n' + afterHeader)
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('\n');

            if (!cleanedInner) {
                // 如果只剩下 header，整个注释块移除
                // 但如果是 PHP 文件，<?php 应该保留
                if (ext === '.php' && fullComment.trim().startsWith('<?php')) {
                    content = content.replace(fullComment, '<?php\n');
                } else {
                    content = content.replace(fullComment, '');
                }
            } else {
                let newComment = `${config.start}\n${cleanedInner}\n${config.end}`;
                // PHP: 保持 <?php 在前
                if (ext === '.php' && fullComment.trim().startsWith('<?php')) {
                    newComment = `<?php\n\n${newComment}`;
                }
                content = content.replace(fullComment, () => newComment);
            }
        }

        return content.trim();
    }

    /**
     * 获取文件大小
     * @param {string} filePath 文件路径
     * @param {Object} [options] 配置选项
     * @param {boolean} [options.humanReadable=false] 是否返回人类可读格式
     * @returns {Promise<number|string>} 文件大小（字节或人类可读字符串）
     */
    static async getFileSize(filePath, options = {}) {
        try {
            const stats = await fs.stat(filePath);
            const sizeInBytes = stats.size;

            if (options.humanReadable) {
                return this.formatFileSize(sizeInBytes);
            }
            return sizeInBytes;
        } catch (error) {
            throw new Error(`获取文件大小失败: ${error.message}`);
        }
    }

    /**
     * 格式化文件大小为人类可读格式
     * @param {number} bytes 文件大小（字节）
     * @returns {string} 格式化后的文件大小
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

export default FileHeaderManager;
