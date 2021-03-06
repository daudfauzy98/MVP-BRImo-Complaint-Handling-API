import express from 'express'
import bodyParser from 'body-parser'
import Customer from '../model/customer.js'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import Config from '../config/config.js'
import secretCode from '../model/secretCode.js'
import nodemailer from 'nodemailer'
import generator from 'generate-password'
import CustService from '../model/cs.js'

const CustomerRouter = express.Router()

CustomerRouter.use(bodyParser.urlencoded({ extended: false }))
CustomerRouter.use(bodyParser.json())

//SignUp
//POST /api/customer/signup
CustomerRouter.post('/signup', async(req, res) => {
    try {
        const { name, email, password, account_number, no_ktp } = req.body
        Customer.findOne({ $or: [{ email }, { account_number }, { no_ktp }] }, async(err, customer) => {
            if (customer) {
                res.status(201).json({ message: 'The email address or identity you have entered is already associated with another account.' })
            } else {
                var saltRounds = 12
                const hashedPassword = await bcrypt.hash(password, saltRounds)

                customer = new Customer({
                    "name": name,
                    "email": email,
                    "password": hashedPassword,
                    "account_number": account_number,
                    "no_ktp": no_ktp,
                })

                // Create and save the customer
                customer.save(function(err) {
                    if (err) {
                        return res.status(500).json({ msg: err.message });
                    }
                    // Create a verification token for this customer
                    var token = new secretCode({ _custId: customer._id, token: crypto.randomBytes(16).toString('hex') });
                    console.log(token)
                        // Save the verification token
                    token.save(function(err) {
                        if (err) { return res.status(500).json({ msg: err.message }); }
                        console.log('Hello,\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/api\/customer\/verify\/' + customer.email + '\/' + token.token)

                        //Show in Postman Only
                        //res.status(200).json('Hello,\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/api\/customer\/verify\/' + customer.email + '\/' + token.token)

                        // Send the email
                        var transporter = nodemailer.createTransport({ name: 'no-reply@BRImo.com', host: 'smtp.ethereal.email', port: 587, auth: { user: process.env.MAIL, pass: process.env.PASS } });
                        var mailOptions = { from: process.env.MAIL, to: customer.email, subject: 'Account Verification Token', text: 'Hello,\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/api\/customer\/verify\/' + customer.email + '\/' + token.token };
                        transporter.sendMail(mailOptions, function(err) {
                            if (err) { return res.status(500).json({ msg: err.message }); }
                            res.status(200).json('A verification email has been sent to ' + customer.email + '.');
                            //res.status(200).json('A verification email has been sent to ' + customer.email + '.\n', 'Message sent: %s', info.messageId + '\n' + 'Preview URL: %s', nodemailer.getTestMessageUrl(info));
                        });
                    });
                })
            }
        })
    } catch (error) {
        res.status(500).json({ error: error })
    }
})

//SEND MAIL
// api/customer/resend
CustomerRouter.post('/resend', async(req, res) => {
    try{
    Customer.findOne({ email: req.body.email }, function(err, customer) {
        if (!customer) return res.status(201).json({ msg: 'We were unable to find a user with that email.' });
        if (customer.isVerified) return res.status(201).json({ msg: 'This account has already been verified. Please log in.' });

        // Create a verification token, save it, and send email
        var token = new secretCode({ _custId: customer._id, token: crypto.randomBytes(16).toString('hex') });
        console.log(token)
        console.log('Hello,\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/api\/customer\/verify\/' + customer.email + '\/' + token.token)

        //Show in Postman only
        //res.status(200).json('Hello,\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/api\/customer\/verify\/' + customer.email + '\/' + token.token)

        // Save the token
        token.save(function(err) {
            if (err) { return res.status(500).json({ msg: err.message }); }

            // Send the email
            var transporter = nodemailer.createTransport({ name: 'no-reply@BRImo.com', host: 'smtp.ethereal.email', port: 587, auth: { user: process.env.MAIL, pass: process.env.PASS } });
            var mailOptions = { from: process.env.MAIL, to: customer.email, subject: 'Account Verification Token', text: 'Hello,\n\n' + 'Please verify your account by clicking the link: \nhttp:\/\/' + req.headers.host + '\/api\/customer\/verify\/' + customer.email + '\/' + token.token };
            transporter.sendMail(mailOptions, function(err) {
                if (err) { return res.status(500).json({ msg: err.message }); }
                res.status(200).json('A verification email has been sent to ' + customer.email + '.')
                    //res.status(200).json('A verification email has been sent to ' + customer.email + '.\n', 'Message sent: %s', info.messageId + '\n' + 'Preview URL: %s', nodemailer.getTestMessageUrl(info));
            });
        });

    });
} catch (error) {
    res.status(500).json({ error: error })
}
})

//Verify
//GET /api/customer/verify/:email/:token
CustomerRouter.get('/verify/:email/:token', async(req, res) => {
    try{
    // Find a matching token
    secretCode.findOne({ token: req.params.token }, function(err, token) {
        if (!token) return res.status(201).json({ type: 'not-verified', msg: 'We were unable to find a valid token. Your token my have expired.' });

        // If we found a token, find a matching user
        Customer.findOne({ _id: token._custId, email: req.params.email }, function(err, customer) {
            if (!customer) return res.status(201).json({ msg: 'We were unable to find a user for this token.' });
            if (customer.isVerified) return res.status(201).json({ type: 'already-verified', msg: 'This user has already been verified.' });

            // Verify and save the user
            customer.isVerified = true;
            customer.save(function(err) {
                if (err) { return res.status(500).json({ msg: err.message }); }
                res.status(200).json("The account has been verified. Please log in.");
            });
        });
    });
}catch (error) {
    res.status(500).json({ error: error })
}
});

//Login endpoint untuk customer
// /api/customer/login
CustomerRouter.post('/login', async(req, res) => {
    try {
        const { email, password } = req.body

        const currentCustomer = await new Promise((resolve, reject) => {
            Customer.find({ "email": email }, function(err, customer) {
                if (err) reject(err)
                resolve(customer)
            })
        })
        if (currentCustomer[0]) {
            bcrypt.compare(password, currentCustomer[0].password).then(function(result, err) {
                if (result) {
                    if (err) return res.status(201).json("Terdapat masalah saat registering user")
                    else if (currentCustomer[0].isVerified === false) {
                        return res.status(201).json("Please Verify your account")
                    }
                    const customer = currentCustomer[0]
                    var token = jwt.sign({ customer }, Config.secret, {
                        expiresIn: 1800
                    })

                    res.status(200).json({ auth: true, "status": "Success!!", token: token })
                } else {
                    res.status(201).json({
                        "status": "wrong password"
                    })
                }
            })
        } else {
            res.status(201).json({
                "status": "Username not found"
            })
        }
    } catch (error) {
        res.status(500).json({ error: error })
    }
})

//FORGOT PASSWORD
//POST api/customer/forgot-password
CustomerRouter.post('/forgot-password', async(req, res) => {
    try{
    Customer.findOne({ email: req.body.email }, async(err, customer) => {
        if (!customer) return res.status(201).json({ msg: 'We were unable to find a user with that email.' });
        if (customer.isVerified === false) return res.status(201).json({ msg: 'This account has not been verified. Please verify.' });

        //Generate New Password
        var newPassword = generator.generate({
            length: 8,
            numbers: true,
            uppercase: true,
            lowercase: true

        })

        // Hashed Password
        var saltRounds = 12
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

        //Changed Hashed Password
        customer.password = hashedPassword
        console.log(newPassword)
        console.log(customer.password)
        console.log(customer)

        //Show in Postman only
        //res.status(200).json(newPassword)

        // Save the New Password
        customer.save(function(err) {
            if (err) { return res.status(500).json({ msg: err.message }); }

            // Send the email contain new password
            var transporter = nodemailer.createTransport({ name: 'no-reply@BRImo.com', host: 'smtp.ethereal.email', port: 587, auth: { user: process.env.MAIL, pass: process.env.PASS } });
            var mailOptions = { from: process.env.MAIL, to: customer.email, subject: 'Changed Password', text: 'Hello,\n\n' + 'Please input your changed password account by input this new password: ' + newPassword + '.\n' };
            transporter.sendMail(mailOptions, function(err) {
                if (err) { return res.status(500).json({ msg: err.message }); }
                res.status(200).send('A Changed Password has been sent to ' + customer.email + '.');
                //res.status(200).json('A Changed Password has been sent to ' + customer.email + '.\n', 'Message sent: %s', info.messageId + '\n' + 'Preview URL: %s', nodemailer.getTestMessageUrl(info));
            });
        });

    });
}catch (error) {
    res.status(500).json({ error: error })
}
})

//CHANGE PASSWORD
//POST /api/customer/change-password
CustomerRouter.post('/change-password', async(req, res) => {
    try {
        var token = req.headers['x-access-token']
    if (!token) 
       return res.status(401).send({ auth: false, message: 'TIdak ada token yang diberikan!' })

    jwt.verify(token, Config.secret, async(err, decode) => {
       if (err)
          return res.status(500).send({ auth: false, message: 'Failed to authenticate token!'})
    
            const { email, password, newPassword } = req.body
            const currentCustomer = await new Promise((resolve, reject) => {
            Customer.find({ "email": email }, function(err, customer) {
            if (err) reject(err)
                resolve(customer)
            })
        })
        if (currentCustomer[0]) {
            bcrypt.compare(password, currentCustomer[0].password).then(async(result, err) => {
                if (result) {
                    if (err) return res.status(201).json("Terdapat masalah saat registering user")
                    const customer = currentCustomer[0]

                    // Hashed Password
                    var saltRounds = 12
                    const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

                    //Changed password to Hashed Password
                    customer.password = hashedPassword
                    console.log(customer.newPassword)
                    console.log(customer.password)
                    console.log(customer)

                    //Save New Password
                    customer.save()

                    res.status(200).json({ "status": "Successfully Changed Pasword!!" })
                } else {
                    res.status(201).json({
                        "status": "wrong password"
                    })
                }
            })
        } else {
            res.status(201).json({
                "status": "email not found"
            })
        }
        })
    } catch (error) {
        res.status(500).json({ error: error })
    }
})

//GET CS profile
//Show CS profile for customer
//GET api/customer/cs-profile/cs_id
CustomerRouter.get('/cs-profile/cs_id', async(req,res)=>{
    try {
        var token = req.headers['x-access-token']
    if (!token) {
       return res.status(401).send({ auth: false, message: 'Tidak ada token yang diberikan!' })
      }
      jwt.verify(token, Config.secret, async(err, decode) =>{
         if (err) {
            return res.status(500).send({ auth: false, message: 'Failed to authenticate token!' })
         }
         const csProfile= await CustService.findById(req.query.cs_id,{pub_name:1, pub_photo:1})
         if (csProfile) {
             res.status(200).json(csProfile)
         }else{
             res.status(201).json({
                 message: "CS not found"
             })
         }

        })   
    } catch (error) {
        res.status(500).json({ error: error})
    }
})

export default CustomerRouter