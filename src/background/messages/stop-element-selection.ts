import type { PlasmoMessaging } from "@plasmohq/messaging"

type RequestBody = {
  tabId: number;
};

type ResponseBody = {
  success: boolean;
};

const handler: PlasmoMessaging.MessageHandler<RequestBody, ResponseBody> = async (req, res) => {
  const { tabId } = req.body;

  try {
    await chrome.tabs.sendMessage(tabId, {
      name: "stop-element-selection"
    });

    res.send({ success: true });
  } catch (error) {
    console.error("Error stopping element selection:", error);
    res.send({ success: false });
  }
};

export default handler;