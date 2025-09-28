async function loadMap() {
  try {
    const res = await fetch("https://stream.bsitport2026.com/map");
    const data = await res.json();
    const { nodes, edges } = data;

    const canvas = document.getElementById("mapCanvas");
    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges (connections)
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2;
    for (const [from, toList] of Object.entries(edges)) {
      const [x1, y1] = nodes[from];
      toList.forEach(to => {
        const [x2, y2] = nodes[to];
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });
    }

    // Draw nodes
    for (const [name, [x, y]] of Object.entries(nodes)) {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = name === "gate" ? "#e74c3c" : "#3498db";
      ctx.fill();

      // Labels
      ctx.fillStyle = "#000";
      ctx.font = "12px Arial";
      ctx.fillText(name, x + 10, y + 4);
    }
  } catch (err) {
    console.error("Error loading map:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadMap);