console.log('Script loaded');
document.querySelectorAll('.userdelete-form').forEach(form => {
    form.addEventListener('submit', async function(event) {
     event.preventDefault()
      const userId = this.id.split('-')[2]; // Get the user ID from the form ID
      console.log('Attempting to delete user with ID:', userId);
        const formData = {
          id: userId
      };
        // Make the DELETE request
        fetch('/delete/' + userId, { // Corrected endpoint
          method: 'POST', // Change to DELETE if the endpoint accepts DELETE
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData)
        })
        .then(response => response.json())  
        .then(data => {
          console.log(data);
          if (!data.error) {
            // ถ้าไม่มี error = สำเร็จ
            alert("Coupon redeemed successfully!");
            window.location.reload();
          } else {
            // ถ้ามี error
            alert(data.error);
          }
        }) 
        .catch(err => {
          console.error('Error:', err);
        });
    });
  });