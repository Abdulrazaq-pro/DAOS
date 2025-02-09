fetch("http://localhost:3000/webhook", {
  method: "GET",
  //   body: JSON.stringify({ you: "gss" }), // No Content-Type
  
})
  .then((res) => res.text())
  .then(console.log);
