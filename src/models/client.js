const { DataTypes } = require('sequelize');
const sequelize = require('../db/sqlite');

const Client = sequelize.define('Client', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },

    surname: {
        type: DataTypes.STRING,
        allowNull: false
    },

    phone: {
        type: DataTypes.STRING,
        allowNull: true
    }

}, {
    tableName: 'clients',
    timestamps: true
});

module.exports = Client;