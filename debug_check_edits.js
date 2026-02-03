const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('./models/Order');
const User = require('./models/User');

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const checkEdits = async () => {
    await connectDB();

    console.log("Checking for pending edit requests...");
    const pendingOrders = await Order.find({ 'editRequest.pending': true }).populate('agent', 'name email');

    if (pendingOrders.length === 0) {
        console.log("No pending edit requests found in the database.");
    } else {
        console.log(`Found ${pendingOrders.length} pending edit requests:`);
        pendingOrders.forEach(o => {
            console.log(`- Order ${o._id}: Agent ${o.agent.name} (${o.agent._id})`);
            console.log(`  Message: ${o.editRequest.message}`);
        });
    }

    process.exit();
};

checkEdits();
