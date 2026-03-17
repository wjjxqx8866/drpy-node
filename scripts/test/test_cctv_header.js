import fs from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';
import FileHeaderManager from '../../utils/fileHeaderManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 源文件路径
const sourceFile = path.resolve(__dirname, '../../spider/js/央视大全[官].js');
// 测试文件路径
const testFile = path.resolve(__dirname, 'test_cctv_header_temp.js');

async function runTest() {
    console.log('=== 开始测试文件头操作 ===');
    console.log(`源文件: ${sourceFile}`);
    console.log(`测试文件: ${testFile}`);

    try {
        // 1. 复制文件
        console.log('\n[1/6] 正在复制源文件到测试文件...');
        try {
            await fs.copyFile(sourceFile, testFile);
            console.log('✅ 复制完成。');
        } catch (e) {
            console.error('❌ 复制失败:', e.message);
            return;
        }

        // 2. 读取文件头
        console.log('\n[2/6] 正在读取文件头...');
        let header = await FileHeaderManager.readHeader(testFile);
        if (header) {
            console.log('✅ 读取到的文件头:', JSON.stringify(header, null, 2));
        } else {
            console.log('⚠️ 未找到文件头，将尝试创建新文件头。');
            header = {};
        }

        // 3. 修改文件头
        console.log('\n[3/6] 正在修改并写入文件头...');
        const timestamp = Date.now();
        const originalTitle = header.title || 'Unknown';
        header.title = `${originalTitle}_TEST_${timestamp}`;
        header.test_timestamp = timestamp;

        try {
            await FileHeaderManager.writeHeader(testFile, header);
            console.log('✅ 写入操作完成。');
        } catch (e) {
            console.error('❌ 写入失败:', e.message);
            throw e;
        }

        // 4. 再次读取验证
        console.log('\n[4/6] 再次读取以验证写入...');
        const newHeader = await FileHeaderManager.readHeader(testFile);
        console.log('读取到的新文件头:', JSON.stringify(newHeader, null, 2));

        if (newHeader && newHeader.test_timestamp === timestamp) {
            console.log('✅ 验证成功：新字段已存在且值正确。');
        } else {
            console.error('❌ 验证失败：新字段未找到或值不匹配。');
            throw new Error('Verification failed');
        }

        // 5. 移除文件头
        console.log('\n[5/6] 正在移除文件头...');
        // 注意：removeHeader 返回处理后的内容字符串，不自动写入文件
        const contentWithoutHeader = await FileHeaderManager.removeHeader(testFile);

        // 我们需要手动写入文件以验证
        await fs.writeFile(testFile, contentWithoutHeader);
        console.log('✅ 移除操作完成，已写回文件。');

        // 6. 验证移除结果
        console.log('\n[6/6] 验证移除结果...');
        const headerAfterRemove = await FileHeaderManager.readHeader(testFile);
        if (!headerAfterRemove || Object.keys(headerAfterRemove).length === 0) {
            console.log('✅ 验证成功：文件头已移除。');
        } else {
            console.log('❌ 验证失败：文件头仍然存在:', headerAfterRemove);
            throw new Error('Removal verification failed');
        }

        console.log('\n=== 测试全部通过 ===');

    } catch (error) {
        console.error('\n❌ 测试过程中发生错误:', error);
    } finally {
        // 7. 清理
        console.log('\n[7/7] 清理测试文件...');
        try {
            await fs.unlink(testFile);
            console.log('✅ 测试文件已删除。');
        } catch (e) {
            console.error('⚠️ 删除测试文件失败 (可能文件不存在):', e.message);
        }
    }
}

runTest();
