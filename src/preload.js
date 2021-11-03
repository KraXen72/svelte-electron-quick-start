console.log("preload woo")

const { contextBridge } = require('electron')
const { dialog } = require('@electron/remote')
const fs = require('fs')
const production = process.env.NODE_ENV !== 'development';


contextBridge.exposeInMainWorld(
  'api',
  {
    hello: () => {
        dialog.showMessageBoxSync({
            message: "hello",
        })
    },
    fscheck: () => {
        console.log(fs)
    }
  }
)

//console.log(production)

//TODO contextbridge
//TODO test building