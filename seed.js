const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Product = require('./models/Product');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const seedData = async () => {
    try {
        await User.deleteMany();
        await Product.deleteMany();

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);

        const users = [
            {
                name: 'Super Admin',
                email: 'superadmin@oms.com',
                password: hashedPassword,
                role: 'Super Admin'
            },
            {
                name: 'Admin User',
                email: 'admin@oms.com',
                password: hashedPassword,
                role: 'Admin'
            }
        ];

        await User.insertMany(users);
        console.log('Users Seeded');

        const products = [];

        await Product.insertMany(products);
        console.log('Products Seeded');

        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

seedData();
