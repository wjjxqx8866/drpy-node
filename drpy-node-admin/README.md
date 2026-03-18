# DRPY Node Admin

drpy-node 后台管理界面 - 基于 Vue3 + Tailwind CSS 构建的现代化管理系统。

## 功能特性

- 🎨 现代化 UI 设计，支持亮色/暗色主题
- 📱 完全响应式，适配 PC 和移动端
- 🚀 基于 Vite 构建，快速开发体验
- 🔧 环境变量可视化配置
- 📦 源文件管理和验证
- 📋 实时日志查看
- 📚 API 文档查看
- 📁 文件浏览和编辑
- 🗄️ 数据库查询

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **Vite** - 下一代前端构建工具
- **Tailwind CSS** - 实用优先的 CSS 框架
- **Vue Router** - 官方路由管理
- **Pinia** - Vue 3 状态管理
- **Axios** - HTTP 客户端

## 项目结构

```
drpy-node-admin/
├── src/
│   ├── api/           # API 接口
│   ├── components/    # 公共组件
│   ├── router/        # 路由配置
│   ├── stores/        # Pinia 状态管理
│   ├── utils/         # 工具函数
│   ├── views/         # 页面组件
│   ├── App.vue        # 根组件
│   ├── main.js        # 入口文件
│   └── style.css      # 全局样式
├── public/            # 静态资源
├── index.html         # HTML 模板
├── vite.config.js     # Vite 配置
├── tailwind.config.js # Tailwind 配置
└── package.json       # 项目配置
```

## 与 drpy-node 集成

Admin 面板通过 drpy-node-mcp 与主项目通信，需要后端提供相应的 API 接口。

### 日志功能说明

日志查看页面使用 WebSocket 实时接收后端日志。确保：

1. **开发环境**：
   - 后端服务器运行在 `http://localhost:5757`
   - Vite 开发服务器自动代理 `/ws` 请求到后端

2. **生产环境**：
   - 确保后端的 `/ws` 端点可访问
   - 如果前后端分离部署，配置 `VITE_BACKEND_URL` 环境变量
   - 示例：`VITE_BACKEND_URL=http://your-backend:5757`

### 部署说明

#### 开发环境
```bash
# 终端 1: 启动后端
npm run dev

# 终端 2: 启动前端
cd drpy-node-admin
npm run dev
```

#### 生产环境
```bash
# 构建前端
cd drpy-node-admin
npm run build

# 将 dist 目录部署到静态服务器
# 或配置反向代理将 /admin 请求指向 dist 目录
```

#### Nginx 配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 主服务
    location / {
        proxy_pass http://localhost:5757;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 支持
    location /ws {
        proxy_pass http://localhost:5757;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Admin 面板
    location /admin {
        alias /path/to/drpy-node-admin/dist;
        try_files $uri $uri/ /admin/index.html;
    }
}
```

## License

MIT
