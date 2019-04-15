import { h } from 'ricochet'

import 'material-components-web/dist/material-components-web.min.css'

import { App }   from './ts/App'
import { Store } from './ts/store'


// Register web worker
if (navigator.serviceWorker) {
  const serviceWorkerName = '/service-worker.js'

  navigator.serviceWorker
    .register(serviceWorkerName)
    .then(() => console.log('Service worker registered.'))
    .catch(err => console.warn('Service worker could not be registered.', err))
}

// Set up app
(async function() {
  const app = document.getElementById('app')!
  const store = window['store'] = new Store()

  await store.init()

  // Set up view
  app.appendChild(<App store={store} />)
})()
