const connection = require('../../db');

async function findUserByUsername(username) {
  return new Promise((resolve, reject) => {
    connection.query('SELECT * FROM user WHERE name = ?', [username], (err, results) => {
      if (err) return reject(err);
      resolve(results[0]);
    });
  });
}

async function createUser(username, hashedPassword, id) {
  return new Promise((resolve, reject) => {
    connection.query(
      'INSERT INTO user (name, password, id) VALUES (?, ?, ?)',
      [username, hashedPassword, id],
      (err, results) => {
        if (err) return reject(err);
        resolve(results);
      }
    );
  });
}

module.exports = { findUserByUsername, createUser };
