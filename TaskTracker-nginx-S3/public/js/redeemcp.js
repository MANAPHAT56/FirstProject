<!-- ใส่ใน <head> ตามเดิม -->
<script>
    const selectedCoupons = {};

    function increaseQty(couponId) {
        selectedCoupons[couponId] = (selectedCoupons[couponId] || 0) + 1;
        updateQtyDisplay(couponId);
    }

    function decreaseQty(couponId) {
        if (selectedCoupons[couponId] > 0) {
            selectedCoupons[couponId]--;
            updateQtyDisplay(couponId);
        }
    }

    function updateQtyDisplay(couponId) {
        const qtyEl = document.getElementById(`qty-${couponId}`);
        qtyEl.innerText = selectedCoupons[couponId] || 0;
    }

    function redeemAllCoupons() {
        const payload = [];

        <% coupondt.forEach(coupon => { %>
            const qty = selectedCoupons["<%= coupon.id %>"] || 0;
            if (qty > 0) {
                payload.push({
                    couponId: "<%= coupon.id %>",
                    couponName: "<%= coupon.name %>",
                    couponImg: "<%= coupon.img %>",
                    quantity: qty
                });
            }
        <% }); %>

        if (payload.length === 0) {
            alert("กรุณาเลือกคูปองอย่างน้อย 1 อัน");
            return;
        }

        fetch('/redeem-coupon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coupons: payload })
        })
        .then(res => res.json())
        .then(data => {
            if (!data.error) {
                alert('แลกคูปองสำเร็จ!');
                location.reload();
            } else {
                alert('เกิดข้อผิดพลาด: ' + data.error);
            }
        })
        .catch(err => console.error('Error:', err));
    }
</script>
