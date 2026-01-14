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
      name: "start-element-selection"
    });

    res.send({ success: true });
  } catch (error) {
    console.error("Error starting element selection:", error);
    res.send({ success: false });
  }
};

export default handler;