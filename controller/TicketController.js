import express from 'express'
import Ticket from '../model/ticket.js'

const ticketRouter = express.Router()

// Create ticket by Customers
ticketRouter.post('/init-ticket', async(req, res) => {
    // Insert logic here

})

//GET ticket list unread
ticketRouter.get('/ticket-list/unread', async(req, res) => {
    // Insert logic here
    const tickets = await Ticket.aggregate([
        { $match: { status: "unread" } }
    ])
    if (tickets != null) {
        res.json(tickets)
    } else {
        res.send("Ticket is empty")
    }

})

//PUT Claim ticket
ticketRouter.put('/pickticket', async(req,res)=>{
    const [idTicket , idCS]= req.body
    const ticket= Ticket.findById(idTicket)
    if (ticket) {
        Ticket.aggregate([{
            $replaceWith: {assigned_to:{idCS}}
        }])

        const updateTicket= await ticket.save()
        res.json(updateTicket)
    } else{
        res.send("Update ticket failed")
    }
})

//GET Ticket search based on tag and category endpoint
ticketRouter.get('/ticket-list/search', async(req, res) => {
    const tickets = await Ticket.aggregate(
        [{
                $match: { tag: String(req.query.tag) }
            },
            {
                $match: { category: String(req.query.category) }
            }
        ]
    )
    if (tickets) {
        res.json(tickets)
    } else {
        res.send("Ticket not found")
    }
})

export default ticketRouter