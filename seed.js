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
        const Product = require('./models/Product');
        const Customer = require('./models/Customer');
        const Order = require('./models/Order');

        await User.deleteMany();
        await Product.deleteMany();
        await Customer.deleteMany();
        await Order.deleteMany();

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);

        const users = [
            {
                name: 'Super Admin',
                email: 'superadmin@oms.com',
                username: 'superadmin',
                password: hashedPassword,
                role: 'Super Admin'
            },
            {
                name: 'Admin User',
                email: 'admin@oms.com',
                username: 'admin',
                password: hashedPassword,
                role: 'Admin'
            }
        ];

        const createdUsers = await User.insertMany(users);
        console.log('Users Seeded');

        const products = [
            { name: 'Fadna Shape Up Tea', price: 1200, weight: 50, unit: 'g', description: 'Weight loss tea' },
            { name: 'Fadna Green Tea', price: 800, weight: 40, unit: 'g', description: 'Pure green tea' },
            { name: 'Fadna Detox Tea', price: 1500, weight: 60, unit: 'g', description: 'Detoxifying herbal tea' }
        ];

        const createdProducts = await Product.insertMany(products);
        console.log('Products Seeded');

        const customers = [
            {
                name: 'John Doe',
                phone: '0771234567',
                address: '123, Main Street',
                city: 'Colombo',
                email: 'john@example.com'
            }
        ];

        const createdCustomers = await Customer.insertMany(customers);
        console.log('Customers Seeded');

        const order = new Order({
            customer: createdCustomers[0]._id,
            items: [
                {
                    product: createdProducts[0]._id,
                    productName: createdProducts[0].name,
                    quantity: 2,
                    price: createdProducts[0].price
                }
            ],
            totalAmount: 2400,
            deliveryCharge: 350,
            finalAmount: 2750,
            agent: createdUsers[0]._id,
            status: 'Pending',
            paymentStatus: 'COD'
        });

        await order.save();
        console.log('Orders Seeded');

        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

seedData();
