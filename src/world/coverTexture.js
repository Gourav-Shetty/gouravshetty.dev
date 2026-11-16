import * as THREE from 'three';

export function makePlaque(p) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#141414';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#f2f2f2';
  g.textAlign = 'center';
  g.font = '600 44px "Josefin Sans", sans-serif';
  g.fillText((p.title || '').slice(0, 24), 256, 58);
  g.font = '400 30px "Josefin Sans", sans-serif';
  g.fillStyle = '#bdbdbd';
  g.fillText(`${p.year || ''} — ${(p.stack || []).slice(0, 2).join(' · ')}`.slice(0, 40), 256, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeCoverTexture(project, W = 740, H = 1000) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  if (project.image && project._img) {
    // Dedicated gallery artwork: crisp clean white paper background
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);

    const iw = project._img.naturalWidth || project._img.width;
    const ih = project._img.naturalHeight || project._img.height;
    // Scale drawing cleanly so it fills the frame aperture with zero distortion
    const s = Math.min(W / iw, H / ih);
    const dw = Math.round(iw * s);
    const dh = Math.round(ih * s);
    const dx = Math.round((W - dw) / 2);
    const dy = Math.round((H - dh) / 2);
    g.drawImage(project._img, dx, dy, dw, dh);
    return c;
  }

  // Fallback for procedural or repo screenshot
  g.fillStyle = '#0b0b0b';
  g.fillRect(0, 0, W, H);
  const artH = Math.round(H * 0.65);
  if (project._img) {
    const iw = project._img.naturalWidth || project._img.width;
    const ih = project._img.naturalHeight || project._img.height;
    const s = Math.max(W / iw, artH / ih);
    const dw = iw * s, dh = ih * s;
    g.drawImage(project._img, (W - dw) / 2, (artH - dh) / 2, dw, dh);
  } else {
    g.fillStyle = project.color || '#fff';
    g.globalAlpha = 0.9;
    drawPattern(g, project.pattern || 'grid', project.color || '#fff', W, artH);
    g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(0, artH, W, H - artH);
  g.fillStyle = '#fff';
  g.font = '700 52px "Josefin Sans", sans-serif';
  g.fillText(project.title.slice(0, 18), 40, artH + 90);
  g.font = '400 30px "Josefin Sans", sans-serif';
  g.fillStyle = '#ddd';
  g.fillText((project.tagline || '').slice(0, 32), 40, artH + 150);
  g.fillStyle = project.color || '#fff';
  g.font = '600 26px "Josefin Sans", sans-serif';
  g.fillText((project.stack || []).slice(0, 3).join(' · ').slice(0, 34), 40, artH + 215);
  return c;
}

function drawPattern(g, kind, color, W = 740, H = 650) {
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 3;
  if (kind === 'waves') {
    for (let y = 40; y < H; y += 36) {
      g.beginPath();
      for (let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin(x / 40 + y) * 12);
      g.stroke();
    }
  } else if (kind === 'dots') {
    for (let y = 30; y < H - 20; y += 40) for (let x = 30; x < W - 20; x += 40) {
      g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
    }
  } else if (kind === 'rings') {
    for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(W / 2, H / 2, 20 + i * 28, 0, 7); g.stroke(); }
  } else if (kind === 'diagonal') {
    for (let i = -W; i < W * 2; i += 36) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 300, H); g.stroke();
    }
  } else if (kind === 'bars') {
    for (let x = 20; x < W; x += 44) {
      const h = 60 + ((x * 7919) % (H - 100));
      g.fillRect(x, H - h, 22, h);
    }
  } else if (kind === 'triangles') {
    for (let y = 20; y < H; y += 70) for (let x = 20; x < W; x += 70) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y + 44); g.lineTo(x - 30, y + 44); g.stroke();
    }
  } else if (kind === 'cross') {
    for (let y = 20; y < H; y += 52) for (let x = 20; x < W; x += 52) {
      g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.moveTo(x, y - 10); g.lineTo(x, y + 10); g.stroke();
    }
  } else {
    for (let x = 0; x <= W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  }
}
