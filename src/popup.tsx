import { useEffect } from "react"
import "~style.css"

function IndexPopup() {
  useEffect(() => {
    chrome.tabs.create({ url: "chrome-extension://" + chrome.runtime.id + "/tabs/dashboard.html" })
    window.close()
  }, [])

  return (
    <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-h-16 plasmo-w-40">
      Opening MiniBlaze Dashboard...
    </div>
  )
}

export default IndexPopup
