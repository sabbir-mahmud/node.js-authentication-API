import UserModel from "../models/User.js";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

// Create a new user
const createUser = async (req, res) => {
    try {
        const { email, password, confirm_password, first_name, last_name } = req.body;
        if (email && password && confirm_password && first_name && last_name) {
            if (password === confirm_password) {
                const user = await UserModel.findOne({ email: email });
                if (!user) {
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(password, salt);
                    const newUser = new UserModel({
                        email: email,
                        password: hashedPassword,
                        first_name: first_name,
                        last_name: last_name,
                        is_staff: false,
                        is_admin: false
                    });
                    await newUser.save();
                    const saved_user = await UserModel.findOne({ email: email });
                    const token = jwt.sign({ userID: saved_user._id }, process.env.JWT_SECRET_KEY, { expiresIn: '1d' })
                    res.status(200).json({
                        message: "User created successfully", token: token
                    });
                } else {
                    res.status(400).json({
                        message: "User already exists"
                    });
                }
            } else {
                res.status(400).json({
                    message: "Passwords do not match"
                });
            }
        } else {
            res.status(400).json({
                message: "Please fill all the required fields"
            });
        }


    } catch (err) {
        console.log(err);
    }
}

export { createUser };