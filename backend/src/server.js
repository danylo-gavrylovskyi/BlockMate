require('dotenv').config();

const config = require('./config');
const app = require('./app');

const port = config.port || 3000;
app.listen(port, () => console.log(`BlockMate backend running on port ${port}`));
