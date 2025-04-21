// console.log('Script loaded');
// document.getElementById('KUY').addEventListener('submit', function(event) { // Prevent the default form submission
//                 event.preventDefault();
//                 const formData = {
//                     name: document.getElementById('name').value,
//                     password: document.getElementById('password').value
//                 };
//                 console.log(formData);
                
//                 fetch('/create-table', {
//                     method: 'POST',
//                     headers: {
//                         'Content-Type': 'application/json',
//                     },
//                     body: JSON.stringify(formData)
                    
//                 })
//                 .then(response => response.json())  
//                 .then(data => {
//                     console.log(data);
//                     if (!data.error) {
//                         alert(data.message); // Show alert for errors
//                         window.location.reload();
//                     }else{
//                         alert(data.error);
//                          window.location.href='\login';
//                     }
//                 })
//                 .catch(err => {
//                         console.error('Error:',err);
//                 });
//             });