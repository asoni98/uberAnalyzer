import Vue from 'vue'

import 'normalize.css/normalize.css' // A modern alternative to CSS resets

import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import locale from 'element-ui/lib/locale/lang/en' // lang i18n

import '@/styles/index.scss' // global css

import App from './App'
import store from './store'
import router from './router'

import '@/icons' // icon
import '@/permission' // permission control

import firebase from 'firebase'

// set ElementUI lang to EN
Vue.use(ElementUI, { locale })

Vue.config.productionTip = false

const config = {
  apiKey: 'xxxxxx',
  authDomain: 'uber-analyzer.firebaseapp.com',
  databaseURL: 'https://uber-analyzer.firebaseio.com',
  projectId: 'xxxxxxx',
  storageBucket: 'xxxxx',
  messagingSenderId: 'xxxxxx',
  appId: 'xxxxxxx',
  measurementId: 'xxxxxx'
}
firebase.initializeApp(config)

new Vue({
  el: '#app',
  router,
  store,
  render: h => h(App)
})
