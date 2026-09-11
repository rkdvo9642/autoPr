const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('pcAutoPR', {
  platform: process.platform,
});
