import apiClient from './client'

export const fileApi = {
  // List directory via MCP
  async listDirectory(path = '.') {
    const response = await apiClient.post('/admin/mcp', {
      name: 'list_directory',
      arguments: { path }
    })
    // MCP returns array format, convert to {files: [...]}
    if (Array.isArray(response)) {
      return {
        files: response.map(f => ({
          name: f.name,
          path: path === '.' ? f.name : `${path}/${f.name}`.replace(/^\.\//, ''),
          isDirectory: f.isDirectory,
          size: f.size
        }))
      }
    }
    return response
  },

  // Read file via MCP
  async readFile(path) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'read_file',
      arguments: { path }
    })
    // MCP 返回格式: { content: [{ type: "text", text: '{"type":"text","content":"..."}' }] }
    // 需要解析多层结构，同时保持与 Files.vue 的兼容性
    console.log('read_file raw response:', response)
    if (response?.content?.[0]?.text) {
      try {
        const parsed = JSON.parse(response.content[0].text)
        console.log('read_file parsed:', parsed)
        // 返回与 Files.vue 兼容的格式
        if (parsed.type === 'text') {
          return { type: 'text', content: parsed.content }
        } else if (parsed.type === 'image') {
          return { type: 'image', dataUrl: parsed.dataUrl }
        }
        return parsed
      } catch (e) {
        // 如果解析失败，可能直接返回文本
        return { type: 'text', content: response.content[0].text }
      }
    }
    return response
  },

  // Write file via MCP
  async writeFile(path, content) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'write_file',
      arguments: { path, content }
    })
    console.log('write_file response:', response)
    // MCP 返回格式: { content: [{ type: "text", text: "Successfully wrote..." }] }
    return response?.content?.[0]?.text || response
  },

  // Delete file via MCP
  async deleteFile(path) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'delete_file',
      arguments: { path }
    })
    return response
  }
}
