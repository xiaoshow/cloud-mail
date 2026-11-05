<template>
  <el-container class="layout">
    <el-aside
        class="aside"
        :class="uiStore.asideShow ? 'aside-show' : 'el-aside-hide'">
      <Aside />
    </el-aside>
    <div
        :class="(uiStore.asideShow && isMobile)? 'overlay-show':'overlay-hide'"
        @click="uiStore.asideShow = false"
    ></div>
    <el-container class="main-container">
      <el-main>
        <el-header>
            <Header />
        </el-header>
        <Main />
      </el-main>
    </el-container>
  </el-container>
  <writer ref="writerRef" />
</template>

<script setup>
import Aside from '@/layout/aside/index.vue'
import Header from '@/layout/header/index.vue'
import Main from '@/layout/main/index.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {useUiStore} from "@/store/ui.js";
import {useEmailStore} from "@/store/email.js";
import {useRoute} from "vue-router";
import writer from '@/layout/write/index.vue'

const uiStore = useUiStore();
const emailStore = useEmailStore();
const route = useRoute();
const writerRef = ref({})
const isMobile = ref(window.innerWidth < 1025)
const handleResize = () => {
  isMobile.value = window.innerWidth < 1025
  uiStore.asideShow = window.innerWidth > 1024;
}

/* ---------- Gmail 风格快捷键 ---------- */
let cursorEl = null
function clearCursor() {
  if (cursorEl) cursorEl.classList.remove('kbd-cursor')
}
function emailRows() {
  return Array.from(document.querySelectorAll('.email-row'))
}
function moveCursor(dir) {
  const list = emailRows()
  if (!list.length) return
  let idx = cursorEl ? list.indexOf(cursorEl) : -1
  idx += dir
  if (idx < 0) idx = 0
  if (idx > list.length - 1) idx = list.length - 1
  clearCursor()
  cursorEl = list[idx]
  cursorEl.classList.add('kbd-cursor')
  cursorEl.scrollIntoView({ block: 'nearest' })
}
function focusSearch() {
  const inputs = Array.from(document.querySelectorAll('.email-container input, input[type="text"]'))
  const vis = inputs.find(i => i.offsetParent !== null)
  if (vis) { vis.focus(); vis.select && vis.select(); return true }
  return false
}
function isTyping() {
  const el = document.activeElement
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}
function onKeydown(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (isTyping()) return
  switch (e.key) {
    case 'c': case 'C':
      e.preventDefault(); writerRef.value?.open?.(); break
    case '/':
      if (focusSearch()) e.preventDefault(); break
    case 'j': case 'J':
      e.preventDefault(); moveCursor(1); break
    case 'k': case 'K':
      e.preventDefault(); moveCursor(-1); break
    case 'Enter':
      if (cursorEl) { e.preventDefault(); cursorEl.click() } break
    case 'r': case 'R':
      if (route.name === 'content' && emailStore.contentData?.email && emailStore.contentData?.showReply) {
        e.preventDefault(); writerRef.value?.openReply?.(emailStore.contentData.email)
      }
      break
  }
}

onMounted(() => {
  uiStore.writerRef = writerRef

  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', onKeydown)
  handleResize()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style lang="scss" scoped>
.el-aside-hide {
  position: fixed;
  left: 0;
  height: 100%;
  z-index: 100;
  transform: translateX(-100%);
  transition: all 100ms ease;
}

.aside-show {
  -webkit-box-shadow: var(--aside-right-border);
  box-shadow: var(--aside-right-border);
  transform: translateX(0);
  transition: all 100ms ease;
  z-index: 101;
  @media (max-width: 1025px) {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 101;
    height: 100%;
    background: var(--el-bg-color);
  }
}

.el-aside {
  width: auto;
  transition: all 100ms ease;
}

.layout {
  height: 100%;
  position: fixed;
  width: 100%;
  top: 0;
  left: 0;
  overflow: hidden;
}

.main-container {
  min-height: 100%;
  background: var(--el-bg-color);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.el-main {
  padding: 0;
}

.el-header {
  background: var(--el-bg-color);
  border-bottom: solid 1px var(--el-border-color);
  padding: 0 0 0 0;
}

.overlay-show {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  z-index: 99;
  transition: all 0.3s;
}

.overlay-hide {
  display: flex;
  pointer-events: none;
  opacity: 0;
}
</style>

<style>
/* Gmail 风格快捷键光标高亮 */
.email-row.kbd-cursor {
  box-shadow: inset 3px 0 0 #409eff;
  background: rgba(64, 158, 255, 0.10) !important;
}
</style>
