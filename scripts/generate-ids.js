const handler = require('../api/generateIds');

const req = { method: 'POST' };
const res = {
  status(code) {
    this.code = code;
    return this;
  },
  json(data) {
    console.log(JSON.stringify(data, null, 2));
  }
};

handler(req, res).catch(err => {
  console.error(err);
  process.exit(1);
});
