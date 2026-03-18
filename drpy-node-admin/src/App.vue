<script setup>
import { RouterView } from 'vue-router'
import { useThemeStore } from './stores/theme'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'

const themeStore = useThemeStore()
</script>

<template>
  <div class="app-container">
    <!-- Mobile overlay -->
    <div
      v-if="themeStore.sidebarOpen"
      @click="themeStore.closeSidebar"
      class="fixed inset-0 bg-black/50 z-40 lg:hidden"
    />

    <!-- Sidebar -->
    <Sidebar />

    <!-- Main content area -->
    <div class="main-content">
      <!-- Fixed Header -->
      <Header />

      <!-- Scrollable content -->
      <main class="content-area">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" :key="$route.path" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style>
/* 应用容器 - 确保占满整个视口高度 */
.app-container {
  min-height: 100vh;
  background-color: rgb(249 250 251);
}

.dark .app-container {
  background-color: rgb(17 24 39);
}

/* 主内容区域 */
.main-content {
  margin-left: 0;
}

@media (min-width: 1024px) {
  .main-content {
    margin-left: 16rem;
  }
}

/* 内容区域 - 确保有最小高度 */
.content-area {
  padding: 1rem 1rem 1rem 1rem;
  margin-top: 4rem;
  min-height: calc(100vh - 4rem);
}

@media (min-width: 1024px) {
  .content-area {
    padding: 1.5rem;
  }
}

/* 路由切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 确保页面内容正确显示 */
.content-area > div {
  min-height: 100%;
}
</style>
