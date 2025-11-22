const { DataTypes } = require('sequelize');
const sequelize = require('../db/sqlite');

class Client {
    constructor(row) {
        this.id = row.id;
        this.name = row.name;
        this.email = row.email;
        this.surname = row.surname;
        this.phone = row.phone;
        this.birth_date = row.birth_date;
    }
}

module.exports = Client;