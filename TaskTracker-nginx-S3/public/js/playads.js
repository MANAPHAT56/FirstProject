
  const showAdBtn = document.getElementById('showAd');
  const adOverlay = document.getElementById('adOverlay');
  const closeAdBtn = document.getElementById('closeAd');
  const adVideo = document.getElementById('adVideo');

  // แสดง overlay
  showAdBtn.onclick = () => {
    adOverlay.style.display = 'flex';
    adVideo.currentTime = 0;
    adVideo.play();
  };

  // ปิด overlay
  closeAdBtn.onclick = () => {
    adOverlay.style.display = 'none';
    adVideo.pause();
  };

  // เมื่อดูจบ ส่งแต้ม
  adVideo.addEventListener('ended', () => {
    fetch('/reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ point: 10 })
    })
    .then(res => {
      if (!res.ok) throw new Error("เพิ่มแต้มไม่สำเร็จ");
      return res.json();
    })
    .then(data => {
      alert("คุณได้รับ 10 แต้มแล้ว!");
      adOverlay.style.display = 'none'; // ปิดหลังดูจบ
    })
    .catch(err => {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการเพิ่มแต้ม");
    });
  });

