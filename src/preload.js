console.log("preload woo")

const { contextBridge } = require('electron')
const { dialog } = require('@electron/remote')
const fs = require('fs')


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

//TODO contextbridge
//TODO test building