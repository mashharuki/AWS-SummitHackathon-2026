const allowButton =
  document.querySelector<HTMLButtonElement>("#allow-microphone");
const status = document.querySelector<HTMLParagraphElement>("#status");

function setStatus(message: string, state?: "success" | "error"): void {
  if (!status) return;
  status.textContent = message;
  if (state) {
    status.dataset.state = state;
  } else {
    delete status.dataset.state;
  }
}

allowButton?.addEventListener("click", async () => {
  allowButton.disabled = true;
  setStatus("Chromeのマイク許可を確認しています...");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }

    setStatus(
      "マイクを許可しました。このタブを閉じ、SABOROUで音声接続をもう一度押してください。",
      "success",
    );
    allowButton.textContent = "許可済み";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(
      `マイクを許可できませんでした。ChromeまたはOSのマイク設定を確認してください。詳細: ${message}`,
      "error",
    );
    allowButton.disabled = false;
  }
});
