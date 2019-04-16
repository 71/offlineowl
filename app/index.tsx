import { h } from 'ricochet'

import 'material-components-web/dist/material-components-web.min.css'

import { App } from './ts/App'
import { Database } from './ts/db'


// Register web worker
if (navigator.serviceWorker) {
  const serviceWorkerName = process.env.NODE_ENV === 'development' ? '/service-worker.js' : '/offlineowl/service-worker.js'

  navigator.serviceWorker
    .register(serviceWorkerName)
    .then(() => console.log('Service worker registered.'))
    .catch(err => console.warn('Service worker could not be registered.', err))
}

// Set up app
(async function() {
  const db = window['db'] = new Database()
  const app = document.getElementById('app')!

  // Set up view
  app.appendChild(<App db={db} />)
})()
