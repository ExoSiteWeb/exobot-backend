const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send('ExoBot backend is running');
});

app.listen(PORT, () => {
  console.log('Backend running on port ' + PORT);
});
