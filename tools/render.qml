// Renders one frame of a live wallpaper shader to a PNG.
//   qml render.qml -- <shader.frag.qsb> <out.png> <width> <height> <time> [detail]
import QtQuick
import QtQuick.Window

Window {
  id: win
  readonly property var args: Qt.application.arguments.slice(Qt.application.arguments.indexOf("--") + 1)
  width: Number(args[2]); height: Number(args[3])
  visible: true
  color: "black"

  ShaderEffect {
    id: fx
    anchors.fill: parent
    property real time: Number(win.args[4])
    property size resolution: Qt.size(width, height)
    property rect viewport: Qt.rect(0, 0, 1, 1)
    property real detail: Number(win.args[5] || 0)
    fragmentShader: "file://" + win.args[0]
  }

  Timer {
    interval: 400; running: true
    onTriggered: { if (fx.status !== ShaderEffect.Compiled) console.log(fx.log); fx.grabToImage(function(r) { r.saveToFile(win.args[1]); Qt.quit() }) }
  }
}
