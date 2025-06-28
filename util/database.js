require('dotenv').config();
const Sequelize = require("sequelize");

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  port: 3306,
  logging: console.log,
  dialect: "mysql",
  host: process.env.DB_HOST,
  pool: {
    max: 5,
    min: 0,
    acquire: 60000, // Increase from default 30000ms
    idle: 10000,
  }
});

module.exports = sequelize;
