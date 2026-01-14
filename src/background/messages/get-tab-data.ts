import type { PlasmoMessaging } from "@plasmohq/messaging"

type RequestBody = {
  xpath: string;
};

type ResponseBody = {
  data: string;
};

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const { xpath } = req.body as RequestBody;

  try {
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const element = result.singleNodeValue as HTMLElement;

    if (!element) {
      res.send({ data: "" });
      return;
    }

    res.send({ data: element.textContent || "" });
  } catch (error) {
    console.error("Error getting tab data:", error);
    res.send({ data: "" });
  }
};

export default handler;