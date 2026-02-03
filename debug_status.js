const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const Order = require('./models/Order');
const User = require('./models/User');

dotenv.config();

const runAudit = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        let output = "--- AUDIT ---\n";

        const total = await Order.countDocuments({ 'editRequest.pending': true });
        output += `TOTAL PENDING IN DB: ${total}\n`;

        if (total > 0) {
            const users = await User.find({});
            for (const user of users) {
                const count = await Order.countDocuments({
                    agent: user._id,
                    'editRequest.pending': true
                });
                if (count > 0) {
                    output += `User: ${user.name} (Role: ${user.role}, ID: ${user._id}) => ${count}\n`;
                }
            }
        }

        fs.writeFileSync('status.txt', output);
        console.log("Done");
        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

runAudit();
