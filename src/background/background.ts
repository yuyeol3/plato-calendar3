import { getCoursesList } from "./updateSchedule";

chrome.runtime.onInstalled.addListener(() => {
  // requestCount를 0으로 초기화하여 storage에 저장
//   chrome.storage.local.set({ requestCount: 0 });
//   console.log('확장 프로그램이 설치되었으며, 카운터를 초기화합니다.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse)=> {
    if (message?.action === "updateData") {
      getCoursesList()
        .then((res)=>{
          sendResponse({result: res});
      });
    }

    return true;
})