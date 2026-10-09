(function () {
  "use strict";
  const room = document.querySelector("#petRoom");
  if (!room) return;
  const key = "hutao-room-scene";
  const order = ["auto", "dawn", "day", "dusk", "night"];
  let preference = "auto";
  try { const saved = localStorage.getItem(key); if (order.includes(saved)) preference = saved; } catch (_) {}
  function currentScene(hour = new Date().getHours()) {
    return hour >= 5 && hour < 8 ? "dawn" : hour >= 8 && hour < 17 ? "day" : hour >= 17 && hour < 19 ? "dusk" : "night";
  }
  function applyScene() {
    const scene = preference === "auto" ? currentScene() : preference;
    room.dataset.timeScene = scene;
    document.body.dataset.petScene = scene;
    const button = document.querySelector("#sceneToggle");
    button.querySelector(".button-label").textContent = "场景：" + (preference === "auto" ? "随时间" : { dawn:"清晨",day:"白天",dusk:"黄昏",night:"夜晚" }[scene]);
    button.querySelector("img").src = `./assets/pet-cottage/ui/04_scenes/scene_${preference}.png`;
    button.setAttribute("aria-pressed", String(preference !== "auto"));
    button.title = "依次切换：随时间、清晨、白天、黄昏、夜晚";
  }
  applyScene();
  setInterval(() => { if (preference === "auto") applyScene(); }, 30000);
  document.querySelector("#sceneToggle").addEventListener("click", () => {
    preference = order[(order.indexOf(preference) + 1) % order.length];
    try { localStorage.setItem(key, preference); } catch (_) {}
    applyScene();
  });
}());
