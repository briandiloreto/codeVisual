// Global instance of VS Code API
let vsCodeApi = undefined;

function getVsCodeApi() {
  if (!vsCodeApi) {
    vsCodeApi = acquireVsCodeApi();
  }

  return vsCodeApi;
}
