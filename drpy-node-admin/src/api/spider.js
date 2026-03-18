import apiClient from './client'

// 解析 MCP 响应的辅助函数
const parseMcpResponse = (response) => {
  console.log('MCP raw response:', response)
  if (response?.content?.[0]?.text) {
    try {
      const parsed = JSON.parse(response.content[0].text)
      console.log('MCP parsed:', parsed)
      return parsed
    } catch (e) {
      console.log('MCP parse error:', e)
      return response.content[0].text
    }
  }
  return response
}

export const spiderApi = {
  // List all sources via MCP
  async listSources() {
    const response = await apiClient.post('/admin/mcp', {
      name: 'list_sources',
      arguments: {}
    })
    // Transform response format from {spider/js, spider/catvod} to {js, catvod}
    return {
      js: response['spider/js'] || [],
      catvod: response['spider/catvod'] || []
    }
  },

  // Validate spider via MCP
  async validateSpider(path) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'validate_spider',
      arguments: { path }
    })
    return parseMcpResponse(response)
  },

  // Check syntax via MCP
  async checkSyntax(path) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'check_syntax',
      arguments: { path }
    })
    return parseMcpResponse(response)
  },

  // Get spider template via MCP
  async getTemplate() {
    const response = await apiClient.post('/admin/mcp', {
      name: 'get_spider_template',
      arguments: {}
    })
    // MCP 返回: { content: [{ type: "text", text: "模板内容..." }] }
    // 模板内容直接在 text 字段中，不是 JSON 格式
    if (response?.content?.[0]?.text) {
      const templateText = response.content[0].text
      console.log('Template text loaded, length:', templateText?.length)
      return templateText
    }
    console.log('Unexpected template response:', response)
    return ''
  },

  // Debug spider rule via MCP
  async debugRule(params) {
    const response = await apiClient.post('/admin/mcp', {
      name: 'debug_spider_rule',
      arguments: params
    })
    return parseMcpResponse(response)
  }
}
