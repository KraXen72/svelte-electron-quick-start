# svelte electron quick start
Get up and running with 💪 Svelte & ⚡ Electron.   
opinionated svelte & electron boilerplate

## Usage
- clone this repo & cd
- ``npm install``
- ``npm run boot`` to run dev enviroment
- to bundle and build app, check ``package.json`` for build scripts / use electron builder

![svelte electron](https://cdn.discordapp.com/attachments/704792091955429426/904777470895616010/unknown.png)

## Structure

- ``src/index.js`` - Main electron process. 
- ``src/svelte.js`` - Svelte app entrypoint. 
- ``src/components`` - Svelte components
- ``src/preload.js`` - Electron preload script
- ``public/global.css`` - Global css file
- ``public/build`` - bundled js and css files by svelte

## Uses:
- electron and svelte
- [rollupjs](https://rollupjs.org/guide/en/) with multiple plugins and [svelte-preprocess](https://github.com/sveltejs/svelte-preprocess) for ts support
- [electron-builder](https://www.electron.build) to build & package app
- [electron-reload](https://www.npmjs.com/package/electron-reload) with custom config for blazing fast reload
- [@electron/remote](https://github.com/electron/remote) to access main process apis in preload

## Credits
- build on the [electron-forge-svelte](https://github.com/codediodeio/electron-forge-svelte). thanks, fireship.io
