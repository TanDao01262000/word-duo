#!/usr/bin/env python3
"""Build starter + personal word banks. Original glosses and examples only."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

# lemma, level, pos, syllables, stress, gloss, example, collocations, family, tags, source
RAW: list[tuple] = [
    # A1
    ("bag", "A1", "noun", "bag", 0, "a soft container you carry things in", "I put my passport in my bag.", "pack a bag", "", "everyday", "starter"),
    ("beach", "A1", "noun", "beach", 0, "sand and sea where people swim and sit", "We walked on the beach in the morning.", "go to the beach", "", "everyday", "starter"),
    ("bed", "A1", "noun", "bed", 0, "a piece of furniture you sleep on", "The hotel bed was soft and clean.", "go to bed", "", "everyday", "starter"),
    ("bird", "A1", "noun", "bird", 0, "an animal with wings and feathers", "A small bird sat in the tree.", "", "", "everyday", "starter"),
    ("breakfast", "A1", "noun", "break-fast", 0, "the first meal of the day", "Breakfast at the hotel starts at seven.", "have breakfast", "", "everyday,tourism", "starter"),
    ("brother", "A1", "noun", "broth-er", 0, "a male sibling", "My brother lives near my parents.", "", "family", "family", "personal"),
    ("bus", "A1", "noun", "bus", 0, "a large vehicle that many people ride", "We took a bus from the airport.", "catch a bus", "", "everyday,tourism", "starter"),
    ("cake", "A1", "noun", "cake", 0, "a sweet baked food, often for a celebration", "She made a cake for the family dinner.", "birthday cake", "", "everyday", "starter"),
    ("car", "A1", "noun", "car", 0, "a road vehicle with four wheels for a few people", "They hired a car for the weekend.", "drive a car", "", "everyday", "starter"),
    ("chair", "A1", "noun", "chair", 0, "a seat for one person", "Please take a chair and wait.", "", "", "everyday", "starter"),
    ("city", "A1", "noun", "cit-y", 0, "a large and important town", "Hanoi is a busy city.", "city centre", "", "everyday", "starter"),
    ("coffee", "A1", "noun", "cof-fee", 0, "a hot brown drink made from coffee beans", "I drink coffee when I start work.", "a cup of coffee", "", "everyday", "starter"),
    ("cold", "A1", "adjective", "cold", 0, "having a low temperature", "The water in the pool was cold.", "", "", "everyday", "starter"),
    ("daughter", "A1", "noun", "daugh-ter", 0, "a female child", "Their daughter is still at school.", "", "family", "family", "personal"),
    ("dinner", "A1", "noun", "din-ner", 0, "the main meal, usually in the evening", "We have dinner with the family on Sundays.", "have dinner", "", "everyday,family", "starter"),
    ("door", "A1", "noun", "door", 0, "the way into a room or building", "Please close the door behind you.", "open the door", "", "everyday", "starter"),
    ("email", "A1", "noun", "e-mail", 0, "a message you send on a computer or phone", "Every day she checks the clients emails.", "send an email,reply to an email", "", "tourism,work", "personal"),
    ("evening", "A1", "noun", "eve-ning", 0, "the part of the day after the afternoon", "The flight arrives in the evening.", "in the evening", "", "everyday", "starter"),
    ("family", "A1", "noun", "fam-i-ly", 0, "your parents, children, and close relatives", "I am close to my family.", "spend time with family", "", "family", "personal"),
    ("father", "A1", "noun", "fa-ther", 0, "a male parent", "Everyone says I look like my father.", "", "family", "family", "personal"),
    ("flight", "A1", "noun", "flight", 0, "a journey in a plane", "She books flights and hotels for clients.", "book a flight,catch a flight", "fly,flight", "tourism", "personal"),
    ("flower", "A1", "noun", "flow-er", 0, "the colourful part of a plant", "There are flowers in front of the house.", "", "", "everyday", "starter"),
    ("food", "A1", "noun", "food", 0, "things that people eat", "The neighbours sometimes share delicious food.", "share food", "", "everyday,family", "personal"),
    ("friend", "A1", "noun", "friend", 0, "a person you like and enjoy spending time with", "I met a friend at the station.", "close friend", "", "everyday", "starter"),
    ("garden", "A1", "noun", "gar-den", 0, "land by a house where plants grow", "The garden behind the house is quiet.", "", "", "everyday", "starter"),
    ("guest", "A1", "noun", "guest", 0, "a person who visits you or stays in a hotel", "The guest arrives at three this afternoon.", "hotel guest", "", "tourism", "personal"),
    ("happy", "A1", "adjective", "hap-py", 0, "feeling pleased and glad", "The children were happy on holiday.", "", "happiness", "everyday", "starter"),
    ("hotel", "A1", "noun", "ho-tel", 1, "a place you stay when you travel", "We booked a hotel near the beach.", "book a hotel,hotel room", "", "tourism", "personal"),
    ("house", "A1", "noun", "house", 0, "a building where a family lives", "Their house is close to a large rice field.", "", "", "hometown,family", "personal"),
    ("kitchen", "A1", "noun", "kitch-en", 0, "the room where you cook", "She is making lunch in the kitchen.", "", "", "everyday", "starter"),
    ("lunch", "A1", "noun", "lunch", 0, "a meal in the middle of the day", "We had lunch at a small restaurant.", "have lunch", "", "everyday", "starter"),
    ("mother", "A1", "noun", "moth-er", 0, "a female parent", "My mother and father come from the same hometown.", "", "family", "family", "personal"),
    ("night", "A1", "noun", "night", 0, "the time when it is dark and most people sleep", "The train leaves late at night.", "at night", "", "everyday", "starter"),
    ("phone", "A1", "noun", "phone", 0, "a device you use to call or send messages", "Please call me on my phone if the flight changes.", "phone number,on the phone", "", "everyday,work", "starter"),
    ("plane", "A1", "noun", "plane", 0, "a vehicle that flies in the sky", "The plane to Da Nang was on time.", "by plane", "flight", "tourism", "starter"),
    ("rain", "A1", "noun", "rain", 0, "water that falls from the sky", "The rain was heavy in the afternoon.", "heavy rain", "", "everyday", "starter"),
    ("rice", "A1", "noun", "rice", 0, "a grain that is a common food, often white or brown", "There is a large rice field around the house.", "rice field", "", "hometown", "personal"),
    ("room", "A1", "noun", "room", 0, "a space in a building with its own walls", "I booked a room for two nights.", "book a room,hotel room", "", "tourism", "personal"),
    ("school", "A1", "noun", "school", 0, "a place where children go to learn", "The village school is near the rice field.", "go to school", "", "everyday", "starter"),
    ("sister", "A1", "noun", "sis-ter", 0, "a female sibling", "My sister often visits at the weekend.", "", "family", "family", "personal"),
    ("son", "A1", "noun", "son", 0, "a male child", "Their son is starting school this year.", "", "family", "family", "personal"),
    ("student", "A1", "noun", "stu-dent", 0, "a person who is studying", "The student is practising English at home.", "", "", "everyday", "starter"),
    ("table", "A1", "noun", "ta-ble", 0, "a piece of furniture with a flat top", "Please leave your key on the table.", "", "", "everyday", "starter"),
    ("ticket", "A1", "noun", "tick-et", 0, "a piece of paper or a code that lets you travel or enter", "She sent the train ticket by email.", "train ticket,plane ticket", "", "tourism", "personal"),
    ("village", "A1", "noun", "vil-lage", 0, "a small group of houses in the countryside", "She lives in a small village in Phu Yen.", "small village", "", "hometown", "personal"),
    ("walk", "A1", "verb", "walk", 0, "to move on your feet at a normal speed", "We walk to the neighbours house.", "go for a walk", "", "everyday", "starter"),
    ("warm", "A1", "adjective", "warm", 0, "a little hot, in a comfortable way", "The countryside is quite warm in the afternoon.", "", "", "hometown", "personal"),
    ("water", "A1", "noun", "wa-ter", 0, "the clear liquid that people drink", "Please bring a bottle of water for the trip.", "a glass of water", "", "everyday", "starter"),
    ("window", "A1", "noun", "win-dow", 0, "a glass opening in a wall", "I opened the window because the room was warm.", "", "", "everyday", "starter"),
    ("work", "A1", "noun", "work", 0, "a job, or the things you do in your job", "She can work from home, so her hours are flexible.", "go to work,work from home", "", "work", "personal"),
    ("book", "A1", "verb", "book", 0, "to arrange to have a room, seat, or ticket later", "I book flights and rooms for the guests.", "book a flight,book a room", "booking", "tourism", "personal"),
    # A2
    ("airport", "A2", "noun", "air-port", 0, "a place where planes take off and land", "Please meet the driver at the airport.", "at the airport", "", "tourism", "personal"),
    ("birthday", "A2", "noun", "birth-day", 0, "the date each year when you were born", "We spent her birthday with the family.", "birthday party", "", "family", "starter"),
    ("busy", "A2", "adjective", "bus-y", 0, "having a lot of things to do", "The reservation desk is busy in the morning.", "", "", "work", "starter"),
    ("cinema", "A2", "noun", "cin-e-ma", 0, "a place where people watch films", "We went to the cinema at the weekend.", "go to the cinema", "", "everyday", "starter"),
    ("client", "A2", "noun", "cli-ent", 0, "a person who pays a company for a service", "She replies to clients emails every day.", "a new client", "", "tourism,work", "personal"),
    ("countryside", "A2", "noun", "coun-try-side", 0, "land outside towns, with fields and trees", "She loves living in the countryside.", "in the countryside", "", "hometown", "personal"),
    ("customer", "A2", "noun", "cus-to-mer", 0, "a person who buys something from a shop or company", "The customer asked for a quiet room.", "customer service", "", "work", "starter"),
    ("delay", "A2", "noun", "de-lay", 1, "a time when something happens later than planned", "There was a delay, so the flight left at nine.", "a short delay", "", "tourism", "starter"),
    ("depart", "A2", "verb", "de-part", 1, "to leave, especially of a plane, train, or bus", "The train will depart at six in the morning.", "depart from", "departure", "tourism", "personal"),
    ("early", "A2", "adjective", "ear-ly", 0, "before the usual or expected time", "We need an early check-in tomorrow.", "early morning", "", "everyday", "starter"),
    ("enough", "A2", "determiner", "e-nough", 1, "as much as you need", "There is enough time to reach the station.", "enough time", "", "everyday", "starter"),
    ("famous", "A2", "adjective", "fa-mous", 0, "known by many people", "Hoi An is famous for its old town.", "famous for", "", "tourism", "starter"),
    ("farmer", "A2", "noun", "farm-er", 0, "a person who grows food or keeps animals", "Her parents are farmers in Phu Yen.", "", "", "family,hometown", "personal"),
    ("forget", "A2", "verb", "for-get", 1, "to not remember something", "Do not forget to take your passport.", "", "", "everyday", "starter"),
    ("holiday", "A2", "noun", "hol-i-day", 0, "a time when you do not work, or a trip you take for fun", "The family spends a lot of time together on holiday.", "go on holiday", "", "family,tourism", "personal"),
    ("hometown", "A2", "noun", "home-town", 0, "the town or village where you grew up", "Her hometown is in central Vietnam.", "", "", "hometown", "personal"),
    ("hungry", "A2", "adjective", "hun-gry", 0, "wanting to eat", "The children were hungry after the walk.", "feel hungry", "", "everyday", "starter"),
    ("island", "A2", "noun", "is-land", 0, "a piece of land with water all around it", "They spent three nights on the island.", "", "", "tourism", "starter"),
    ("job", "A2", "noun", "job", 0, "the work you do, usually for money", "She has had this job for two years.", "a flexible job", "", "work", "personal"),
    ("luggage", "A2", "noun", "lug-gage", 0, "the bags you take with you when you travel", "Please keep your luggage with you at the station.", "heavy luggage", "", "tourism", "personal"),
    ("map", "A2", "noun", "map", 0, "a drawing that shows roads, towns, and places", "The driver sent a map of the hotel.", "on the map", "", "tourism", "starter"),
    ("neighbour", "A2", "noun", "neigh-bour", 0, "a person who lives near you", "The neighbours help take care of the house when she is away.", "next-door neighbour", "", "hometown,family", "personal"),
    ("passport", "A2", "noun", "pass-port", 0, "an official book that lets you travel to other countries", "Please check that the passport is still valid.", "passport number", "", "tourism", "personal"),
    ("polite", "A2", "adjective", "po-lite", 1, "speaking and acting in a kind, respectful way", "The receptionist was polite and clear.", "", "", "work", "starter"),
    ("queue", "A2", "noun", "queue", 0, "a line of people waiting for something", "There was a long queue at the check-in desk.", "wait in a queue", "", "tourism", "starter"),
    ("quiet", "A2", "adjective", "qui-et", 0, "with little or no noise", "They asked for a quiet room at the back.", "a quiet room", "", "tourism", "starter"),
    ("relax", "A2", "verb", "re-lax", 1, "to rest and become calm", "What she likes most about her hometown is that she can relax.", "", "", "hometown", "personal"),
    ("restaurant", "A2", "noun", "res-tau-rant", 0, "a place where you pay to eat a meal", "We booked a restaurant for Friday evening.", "book a restaurant", "", "tourism", "starter"),
    ("return", "A2", "noun", "re-turn", 1, "a ticket for going to a place and coming back", "She booked a return flight for Sunday.", "a return ticket", "", "tourism", "starter"),
    ("season", "A2", "noun", "sea-son", 0, "a part of the year, such as summer or winter", "The dry season is a popular time to travel.", "busy season", "", "tourism", "starter"),
    ("share", "A2", "verb", "share", 0, "to let someone use or have part of something", "The neighbours often share food with us.", "share food", "", "family,hometown", "personal"),
    ("shopping", "A2", "noun", "shop-ping", 0, "the activity of buying things from shops", "They went shopping in the old town.", "go shopping", "", "everyday", "starter"),
    ("sightseeing", "A2", "noun", "sight-see-ing", 0, "visiting famous or interesting places as a visitor", "The morning is free for sightseeing.", "go sightseeing", "", "tourism", "starter"),
    ("station", "A2", "noun", "sta-tion", 0, "a place where trains or buses stop", "Please wait for the driver outside the station.", "train station", "", "tourism", "starter"),
    ("stay", "A2", "verb", "stay", 0, "to live or sleep somewhere for a short time", "They will stay at the hotel for two nights.", "stay at a hotel", "", "tourism", "personal"),
    ("sunny", "A2", "adjective", "sun-ny", 0, "with a lot of bright sun", "It is usually sunny in her hometown.", "a sunny day", "", "hometown", "starter"),
    ("surprise", "A2", "noun", "sur-prise", 1, "something you did not expect", "The free fruit basket was a nice surprise.", "a nice surprise", "", "everyday", "starter"),
    ("sweater", "A2", "noun", "sweat-er", 0, "a warm piece of clothing for the upper body", "Pack a sweater for the evening in the mountains.", "", "", "everyday", "starter"),
    ("tidy", "A2", "adjective", "ti-dy", 0, "clean, with things in the right place", "Please leave the room tidy when you check out.", "", "", "everyday", "starter"),
    ("tired", "A2", "adjective", "tired", 0, "needing to rest", "He felt tired after the long flight.", "feel tired", "", "everyday", "starter"),
    ("travel", "A2", "verb", "trav-el", 0, "to go from one place to another", "She does not need to travel to an office every day.", "travel for work", "", "tourism,work", "personal"),
    ("useful", "A2", "adjective", "use-ful", 0, "helping you do something", "A simple map of the village is useful for guests.", "", "", "everyday", "starter"),
    ("visit", "A2", "verb", "vis-it", 0, "to go and see a person or a place", "We visit our parents every weekend.", "visit family", "", "family", "personal"),
    ("weather", "A2", "noun", "weath-er", 0, "the rain, sun, wind, or temperature at a time", "The weather in the countryside is quite warm.", "", "", "hometown", "starter"),
    ("weekend", "A2", "noun", "week-end", 0, "Saturday and Sunday", "The family spends a lot of time together at the weekend.", "at the weekend", "", "family", "personal"),
    ("worried", "A2", "adjective", "wor-ried", 0, "thinking about a problem and feeling uneasy", "She was worried the email had gone to the wrong client.", "worried about", "", "everyday", "starter"),
    ("province", "A2", "noun", "prov-ince", 0, "a region that is part of a country", "Her parents come from Phu Yen province.", "", "", "hometown", "personal"),
    ("autumn", "A2", "noun", "au-tumn", 0, "the season between summer and winter", "They prefer to travel in autumn, when it is cooler.", "in autumn", "", "everyday", "starter"),
    ("change", "A2", "verb", "change", 0, "to make something different, or to become different", "Please tell us if you change your departure time.", "change a booking", "", "work", "starter"),
    ("please", "A1", "exclamation", "please", 0, "a polite word you use when you ask for something", "A seat by the window, please.", "", "", "everyday", "starter"),

    # B1
    ("accommodation", "B1", "noun", "ac-com-mo-da-tion", 3, "a place to stay, such as a hotel room", "The company booked accommodation near the old town.", "book accommodation", "", "tourism", "personal"),
    ("advice", "B1", "noun", "ad-vice", 1, "an idea about what someone should do", "My parents always give me kind advice, even about work.", "give advice", "", "family", "starter"),
    ("agree", "B1", "verb", "a-gree", 1, "to have the same opinion as someone", "We agree that the morning flight is better.", "agree with", "", "everyday", "starter"),
    ("arrange", "B1", "verb", "ar-range", 1, "to plan and organize something", "She will arrange a transfer from the airport.", "arrange a transfer", "", "tourism,work", "personal"),
    ("available", "B1", "adjective", "a-vail-a-ble", 2, "free to be used, or free to meet", "Is a double room available on Friday night?", "available for", "", "tourism", "personal"),
    ("avoid", "B1", "verb", "a-void", 1, "to stay away from something", "We should avoid the rush hour at the station.", "", "", "everyday", "starter"),
    ("booking", "B1", "noun", "book-ing", 0, "an arrangement to have a room, table, or seat", "Please send the booking by email today.", "make a booking,change a booking", "book", "tourism", "personal"),
    ("cancel", "B1", "verb", "can-cel", 0, "to say that a planned thing will not happen", "The guest had to cancel the second night.", "cancel a booking", "cancellation", "tourism", "personal"),
    ("confirm", "B1", "verb", "con-firm", 1, "to say that something is definite or correct", "Please confirm the departure time by this afternoon.", "confirm a booking", "confirmation", "tourism", "personal"),
    ("convenient", "B1", "adjective", "con-ven-ient", 1, "easy to use, or well placed for you", "The hotel is convenient for the train station.", "", "", "tourism", "starter"),
    ("decision", "B1", "noun", "de-ci-sion", 1, "a choice you make after thinking", "Her parents always support her decision.", "make a decision", "decide", "family,work", "personal"),
    ("describe", "B1", "verb", "de-scribe", 1, "to say what something or someone is like", "Please describe the room to the guest in simple words.", "", "", "work", "starter"),
    ("discount", "B1", "noun", "dis-count", 0, "a lower price than usual", "The hotel offered a discount for a longer stay.", "give a discount", "", "tourism", "starter"),
    ("experience", "B1", "noun", "ex-pe-ri-ence", 1, "knowledge from doing something, or something that happens to you", "She has two years of experience in this job.", "work experience", "", "work", "starter"),
    ("flexible", "B1", "adjective", "flex-i-ble", 0, "able to change easily when needed", "The job is quite flexible because she works from home.", "flexible hours", "", "work", "personal"),
    ("include", "B1", "verb", "in-clude", 1, "to have something as a part", "The price includes breakfast and a late transfer.", "include breakfast", "", "tourism", "starter"),
    ("journey", "B1", "noun", "jour-ney", 0, "travel from one place to another", "The train journey takes about five hours.", "a long journey", "", "tourism", "starter"),
    ("mention", "B1", "verb", "men-tion", 0, "to speak about something briefly", "Please mention the late arrival in the email.", "", "", "work", "starter"),
    ("offer", "B1", "verb", "of-fer", 0, "to say you will give something or do something", "The airline offered a later flight.", "offer a room", "", "tourism,work", "personal"),
    ("prefer", "B1", "verb", "pre-fer", 1, "to like one thing more than another", "They prefer a quiet room at the back.", "prefer to", "", "everyday", "starter"),
    ("prepare", "B1", "verb", "pre-pare", 1, "to get ready, or to make something ready", "She will prepare the itinerary this evening.", "prepare for", "", "work", "starter"),
    ("provide", "B1", "verb", "pro-vide", 1, "to give something that is needed", "The hotel will provide a shuttle to the airport.", "provide a service", "", "tourism", "starter"),
    ("receipt", "B1", "noun", "re-ceipt", 1, "a piece of paper or a message that shows you paid", "Please keep the receipt for the transfer.", "a payment receipt", "", "tourism", "personal"),
    ("reservation", "B1", "noun", "res-er-va-tion", 2, "an arrangement to keep a room, table, or seat for you", "She made a reservation for two nights in Hoi An.", "make a reservation", "reserve,reserved", "tourism", "personal"),
    ("responsible", "B1", "adjective", "re-spon-si-ble", 1, "having the duty to take care of something", "She is responsible for booking all the services.", "responsible for", "", "work", "starter"),
    ("schedule", "B1", "noun", "sched-ule", 0, "a plan of times for things to happen", "The new schedule arrives in your email tonight.", "a busy schedule", "", "tourism,work", "personal"),
    ("suggest", "B1", "verb", "sug-gest", 1, "to give an idea for someone to consider", "I suggest a morning departure, when the road is quieter.", "suggest a hotel", "", "work", "starter"),
    ("suitable", "B1", "adjective", "suit-a-ble", 0, "right for a person, purpose, or situation", "This family room is suitable for two adults and a child.", "suitable for", "", "tourism", "starter"),
    ("support", "B1", "verb", "sup-port", 1, "to help someone, or to agree with a choice", "Her parents always support her decision.", "support a decision", "", "family", "personal"),
    ("transfer", "B1", "noun", "trans-fer", 0, "a journey that moves a guest from one place to another, such as the airport to a hotel", "The airport transfer is already prepaid.", "airport transfer,book a transfer", "", "tourism", "personal"),
    ("typical", "B1", "adjective", "typ-i-cal", 0, "usual or normal for a person or thing", "A typical day starts with checking emails.", "a typical day", "", "everyday", "starter"),
    ("voucher", "B1", "noun", "vouch-er", 0, "a ticket or code you can use instead of money", "Please send the hotel voucher to the guest today.", "a hotel voucher", "", "tourism", "personal"),
    ("accept", "B1", "verb", "ac-cept", 1, "to say yes to something that is offered", "The hotel can accept a late check-in.", "accept a booking", "", "work", "starter"),
    ("attend", "B1", "verb", "at-tend", 1, "to go to an event or a meeting", "They will attend a family dinner on Sunday.", "attend a meeting", "", "everyday", "starter"),
    ("celebrate", "B1", "verb", "cel-e-brate", 0, "to do something enjoyable for a special day", "We celebrate holidays at my parents house.", "celebrate a birthday", "", "family", "starter"),
    ("complain", "B1", "verb", "com-plain", 1, "to say you are not happy with something", "The guest called to complain about the late transfer.", "complain about", "", "work", "starter"),
    ("connect", "B1", "verb", "con-nect", 1, "to join two things, or to join one flight to another", "The afternoon flight connects to the night train.", "a connecting flight", "", "tourism", "starter"),
    ("culture", "B1", "noun", "cul-ture", 0, "the way of life and traditions of a group of people", "Guests often ask about the culture in central Vietnam.", "", "", "hometown,tourism", "starter"),
    ("difference", "B1", "noun", "dif-fer-ence", 0, "a way that two things are not the same", "There is a price difference between the two rooms.", "", "", "everyday", "starter"),
    ("direction", "B1", "noun", "di-rec-tion", 1, "the way to go, or an instruction", "The driver will send the direction to the hotel.", "give directions", "", "tourism", "starter"),
    ("event", "B1", "noun", "e-vent", 1, "something that happens, especially something planned", "The family event is on Saturday evening.", "a special event", "", "everyday", "starter"),
    ("improve", "B1", "verb", "im-prove", 1, "to make or become better", "She wants to improve her English pronunciation.", "improve your English", "", "everyday", "starter"),
    ("invitation", "B1", "noun", "in-vi-ta-tion", 2, "a request for someone to come to an event", "They sent an invitation for a family lunch.", "an invitation to", "invite", "family", "starter"),
    ("local", "B1", "adjective", "lo-cal", 0, "from a particular area nearby", "The hotel serves local food from the market.", "local food", "", "hometown,tourism", "starter"),
    ("necessary", "B1", "adjective", "nec-es-sar-y", 0, "needed for a purpose", "A visa is necessary for this trip.", "if necessary", "", "everyday", "starter"),
    ("prepaid", "B1", "adjective", "pre-paid", 1, "paid for in advance", "All services are fully prepaid by the company.", "fully prepaid", "", "tourism", "personal"),
    ("departure", "B1", "noun", "de-par-ture", 1, "the act of leaving, especially of a plane or train", "Please check the departure time again this evening.", "departure time", "depart", "tourism", "personal"),
    ("almost", "B1", "adverb", "al-most", 0, "nearly, but not completely", "The booking is almost ready to send.", "", "", "everyday", "starter"),
    ("check-in", "B1", "noun", "check-in", 0, "the process of arriving and giving your name at a hotel or airport", "Check-in at the hotel starts at two o clock.", "check-in time", "", "tourism", "personal"),
    ("request", "B1", "noun", "re-quest", 1, "an act of politely asking for something", "The guest sent a request for a late departure.", "a special request", "request", "tourism", "personal"),
    # B2
    ("advantage", "B2", "noun", "ad-van-tage", 1, "something that helps you or makes a situation better for you", "Working from home is an advantage when the family needs her.", "an advantage of", "", "work", "starter"),
    ("alternative", "B2", "noun", "al-ter-na-tive", 1, "another choice you can use instead", "If the morning flight is full, there is an evening alternative.", "an alternative to", "", "tourism", "starter"),
    ("attitude", "B2", "noun", "at-ti-tude", 0, "the way you think or feel about something", "A calm attitude helps when a booking changes suddenly.", "a positive attitude", "", "everyday", "starter"),
    ("benefit", "B2", "noun", "ben-e-fit", 0, "a good result you get from something", "A clear itinerary is a benefit for every guest.", "the benefit of", "", "everyday", "starter"),
    ("challenge", "B2", "noun", "chal-lenge", 0, "something difficult that tests your skill", "A late change of hotel can be a challenge.", "a real challenge", "", "work", "starter"),
    ("coincidence", "B2", "noun", "co-in-ci-dence", 1, "when two things happen at the same time by chance", "By coincidence, both families come from the same village.", "by coincidence", "", "everyday", "starter"),
    ("commitment", "B2", "noun", "com-mit-ment", 1, "a promise to do something, or a duty you accept", "The company has a commitment to confirm every room in writing.", "a commitment to", "", "work", "starter"),
    ("comparison", "B2", "noun", "com-par-i-son", 1, "the act of looking at how two things are similar or different", "A comparison of the two hotels helped the client decide.", "in comparison", "compare", "work", "starter"),
    ("complicated", "B2", "adjective", "com-pli-cat-ed", 0, "with many parts and hard to understand", "The train times were more complicated than the flight times.", "", "", "everyday", "starter"),
    ("condition", "B2", "noun", "con-di-tion", 1, "the state something is in, or a rule you must follow", "The room was in excellent condition.", "in good condition", "", "tourism", "starter"),
    ("consequence", "B2", "noun", "con-se-quence", 0, "a result of an action or a situation", "A missed email can have a serious consequence for a booking.", "as a consequence", "", "everyday", "starter"),
    ("contrast", "B2", "noun", "con-trast", 0, "a clear difference between two things", "There is a clear contrast between city life and the village.", "in contrast", "", "everyday", "starter"),
    ("contribute", "B2", "verb", "con-trib-ute", 1, "to give something as part of a group effort", "Each person can contribute a dish to the family meal.", "contribute to", "", "family", "starter"),
    ("definitely", "B2", "adverb", "def-i-nite-ly", 0, "without any doubt", "I will definitely confirm the transfer today.", "", "", "everyday", "starter"),
    ("detail", "B2", "noun", "de-tail", 1, "a small fact or piece of information", "Please check every detail on the voucher before you send it.", "in detail", "", "work", "starter"),
    ("economy", "B2", "noun", "e-con-o-my", 1, "the system of money and business in a country", "Tourism is an important part of the local economy.", "the local economy", "", "everyday", "starter"),
    ("environment", "B2", "noun", "en-vi-ron-ment", 1, "the natural world, or the conditions around you", "A quiet work environment helps her reply to emails carefully.", "a quiet environment", "", "everyday", "starter"),
    ("estimate", "B2", "verb", "es-ti-mate", 0, "to guess an amount using the information you have", "I estimate the drive will take about forty minutes.", "estimate the time", "", "work", "starter"),
    ("evidence", "B2", "noun", "ev-i-dence", 0, "facts that show something is true", "The confirmation email is evidence that the room is reserved.", "", "", "work", "starter"),
    ("feature", "B2", "noun", "fea-ture", 0, "an important or noticeable part of something", "A private balcony is a nice feature of this room.", "a special feature", "", "tourism", "starter"),
    ("focus", "B2", "verb", "fo-cus", 0, "to give all your attention to something", "In the morning she can focus on the urgent emails.", "focus on", "", "work", "starter"),
    ("impact", "B2", "noun", "im-pact", 0, "a strong effect on someone or something", "A cancelled flight has a big impact on the whole itinerary.", "have an impact on", "", "tourism", "starter"),
    ("income", "B2", "noun", "in-come", 0, "money you receive from work or business", "Farming is the main income for her parents.", "a regular income", "", "family", "starter"),
    ("independent", "B2", "adjective", "in-de-pen-dent", 2, "able to work or live without help from others", "The job lets her be independent, but still close to her family.", "", "", "work,family", "starter"),
    ("influence", "B2", "noun", "in-flu-ence", 0, "the power to change how someone thinks or acts", "Her family has a strong influence on her weekend plans, not on her career.", "a strong influence", "", "family", "personal"),
    ("intend", "B2", "verb", "in-tend", 1, "to have a plan to do something", "They intend to stay two extra nights in the countryside.", "intend to", "", "everyday", "starter"),
    ("itinerary", "B2", "noun", "i-tin-er-ar-y", 1, "a plan of places to visit and times on a trip", "Please send the final itinerary to the client this evening.", "a detailed itinerary", "", "tourism", "personal"),
    ("maintain", "B2", "verb", "main-tain", 1, "to keep something in good condition, or to continue it", "The neighbours help maintain the house when she is away.", "maintain a house", "", "hometown", "starter"),
    ("measure", "B2", "verb", "meas-ure", 0, "to find the size or amount of something", "We measure success by how smoothly the trip goes.", "", "", "everyday", "starter"),
    ("obvious", "B2", "adjective", "ob-vi-ous", 0, "easy to see or understand", "It was obvious that the guest needed a quieter room.", "", "", "everyday", "starter"),
    ("occasion", "B2", "noun", "oc-ca-sion", 1, "a particular time, often a special event", "The family dinner was a happy occasion.", "a special occasion", "", "family", "starter"),
    ("opportunity", "B2", "noun", "op-por-tu-ni-ty", 2, "a chance to do something useful or enjoyable", "The weekend is a good opportunity to visit her parents.", "an opportunity to", "", "everyday", "personal"),
    ("option", "B2", "noun", "op-tion", 0, "something you can choose", "A later train is the safest option after the delay.", "another option", "", "tourism", "personal"),
    ("persuade", "B2", "verb", "per-suade", 1, "to make someone agree by giving reasons", "I had to persuade the hotel to keep the late check-out.", "persuade someone to", "", "work", "starter"),
    ("previous", "B2", "adjective", "pre-vi-ous", 0, "happening before the one you are talking about", "The previous booking was for a single room.", "the previous day", "", "work", "personal"),
    ("process", "B2", "noun", "proc-ess", 0, "a series of steps to do something", "The check-in process is usually quick.", "a simple process", "", "work", "starter"),
    ("require", "B2", "verb", "re-quire", 1, "to need something", "This ticket will require a passport number.", "require information", "", "work", "starter"),
    ("resource", "B2", "noun", "re-source", 1, "something you can use to help you", "A clear word list is a useful resource for practice.", "a useful resource", "", "everyday", "starter"),
    ("significant", "B2", "adjective", "sig-nif-i-cant", 1, "important, or large enough to notice", "There was a significant delay at the airport.", "a significant change", "", "everyday", "starter"),
    ("source", "B2", "noun", "source", 0, "the place or person something comes from", "The email is the best source for the new departure time.", "a source of", "", "work", "starter"),
    ("specific", "B2", "adjective", "spe-cif-ic", 1, "exact and clear, not general", "Please send a specific time for the transfer.", "a specific time", "", "work", "starter"),
    ("standard", "B2", "noun", "stan-dard", 0, "a level of quality that is expected", "The hotel keeps a high standard of service.", "a high standard", "", "tourism", "starter"),
    ("temporary", "B2", "adjective", "tem-po-rar-y", 0, "lasting only for a limited time", "This is a temporary change, not a new itinerary.", "a temporary change", "", "work", "starter"),
    ("trend", "B2", "noun", "trend", 0, "a general change or fashion over time", "There is a trend toward longer stays in the countryside.", "a recent trend", "", "everyday", "starter"),
    ("variety", "B2", "noun", "va-ri-e-ty", 1, "many different types of something", "The menu has a wide variety of local dishes.", "a variety of", "", "everyday", "starter"),
    ("willing", "B2", "adjective", "will-ing", 0, "happy to do something if it is needed", "The driver is willing to wait if the flight is late.", "willing to", "", "work", "starter"),
    ("reliable", "B2", "adjective", "re-li-a-ble", 1, "able to be trusted to do what you need", "We only book reliable transfers for late arrivals.", "a reliable service", "", "tourism", "personal"),
    ("rural", "B2", "adjective", "ru-ral", 0, "in the countryside, not in a city", "She lives in a rural village with trees and rice fields.", "a rural area", "", "hometown", "personal"),
    ("balance", "B2", "noun", "bal-ance", 0, "a good mix between different things, such as work and rest", "Working from home helps her keep a better work-life balance.", "work-life balance", "", "work", "personal"),
    ("overview", "B2", "noun", "o-ver-view", 0, "a short description of the main points", "The first page of the itinerary is a clear overview of the trip.", "a brief overview", "", "work", "starter"),

    # C1
    ("accurate", "C1", "adjective", "ac-cu-rate", 0, "correct and exact", "Please make sure the passport number is accurate.", "an accurate record", "", "work", "starter"),
    ("amend", "C1", "verb", "a-mend", 1, "to change something, usually to correct or improve it", "We had to amend the booking after the schedule change.", "amend a booking", "", "tourism", "personal"),
    ("anticipate", "C1", "verb", "an-tic-i-pate", 1, "to expect something and get ready for it", "I anticipate a late arrival, so I asked the hotel to wait.", "anticipate a delay", "", "work", "starter"),
    ("assessment", "C1", "noun", "as-sess-ment", 1, "a judgement of the quality or amount of something", "A quick assessment of the two hotels helped us choose.", "make an assessment", "assess", "work", "starter"),
    ("assume", "C1", "verb", "as-sume", 1, "to believe something is true without complete proof", "Do not assume the transfer is included until it is confirmed.", "assume that", "", "work", "starter"),
    ("complimentary", "C1", "adjective", "com-pli-men-ta-ry", 2, "given free, as a courtesy", "The airline offered a complimentary voucher after the delay.", "a complimentary upgrade", "", "tourism", "personal"),
    ("confirmation", "C1", "noun", "con-fir-ma-tion", 2, "an official statement that something is definite", "The hotel sent confirmation of the room last night.", "a confirmation email", "confirm", "tourism", "personal"),
    ("consistent", "C1", "adjective", "con-sist-ent", 1, "always happening or behaving in the same way", "The times in the voucher should be consistent with the itinerary.", "consistent with", "", "work", "starter"),
    ("crucial", "C1", "adjective", "cru-cial", 0, "extremely important", "An accurate departure time is crucial for the driver.", "crucial for", "", "work", "starter"),
    ("efficient", "C1", "adjective", "ef-fi-cient", 1, "working well without wasting time or resources", "An efficient morning routine leaves more time for emails.", "", "", "work", "starter"),
    ("emerge", "C1", "verb", "e-merge", 1, "to appear, or to become known", "A better option may emerge if the first hotel is full.", "", "", "everyday", "starter"),
    ("ensure", "C1", "verb", "en-sure", 1, "to make sure that something happens", "Please ensure the voucher shows the correct guest names.", "ensure that", "", "work", "starter"),
    ("equivalent", "C1", "adjective", "e-quiv-a-lent", 1, "equal in value, amount, or meaning", "A later train is the equivalent of a delayed flight in this plan.", "equivalent to", "", "everyday", "starter"),
    ("evaluate", "C1", "verb", "e-val-u-ate", 1, "to judge the quality or value of something", "She will evaluate two hotels before she books.", "evaluate options", "", "work", "starter"),
    ("evident", "C1", "adjective", "ev-i-dent", 0, "easy to see or understand", "It was evident from the email that the guest needed a quiet room.", "it is evident that", "", "everyday", "starter"),
    ("explicit", "C1", "adjective", "ex-plic-it", 1, "said or shown clearly, with no doubt", "The email was explicit about the prepaid dinner.", "explicit instructions", "", "work", "starter"),
    ("facilitate", "C1", "verb", "fa-cil-i-tate", 1, "to make a process easier", "A clear itinerary can facilitate a smooth arrival.", "facilitate a process", "", "work", "starter"),
    ("fluctuate", "C1", "verb", "fluc-tu-ate", 0, "to change up and down often", "Room prices fluctuate during the busy season.", "", "", "tourism", "starter"),
    ("framework", "C1", "noun", "frame-work", 0, "a basic structure that supports an idea or a system", "The itinerary gives a simple framework for the whole trip.", "a framework for", "", "work", "starter"),
    ("implication", "C1", "noun", "im-pli-ca-tion", 2, "a possible result, or a meaning that is not said directly", "A missed transfer has implications for the next hotel booking.", "the implications of", "", "work", "starter"),
    ("inevitable", "C1", "adjective", "in-ev-i-ta-ble", 2, "sure to happen and impossible to avoid", "Small delays are almost inevitable in high season.", "", "", "everyday", "starter"),
    ("interpret", "C1", "verb", "in-ter-pret", 1, "to explain or understand the meaning of something", "It is easy to interpret a short email in the wrong way.", "interpret a message", "", "work", "starter"),
    ("justify", "C1", "verb", "jus-ti-fy", 0, "to give a good reason for something", "I can justify the higher room rate because it includes breakfast.", "justify a decision", "", "work", "starter"),
    ("minimise", "C1", "verb", "min-i-mise", 0, "to make something as small as possible", "An earlier departure will minimise the risk of a missed train.", "minimise the risk", "", "work", "starter"),
    ("notion", "C1", "noun", "no-tion", 0, "an idea or belief, often a general one", "He had the notion that the countryside would be quiet.", "the notion that", "", "everyday", "starter"),
    ("overbook", "C1", "verb", "o-ver-book", 0, "to sell more seats or rooms than actually exist", "The flight was overbooked, so the airline offered another seat.", "an overbooked flight", "", "tourism", "personal"),
    ("persist", "C1", "verb", "per-sist", 1, "to continue, especially despite difficulty", "If the error persists, please call the hotel directly.", "persist in", "", "everyday", "starter"),
    ("prior", "C1", "adjective", "pri-or", 0, "happening before something else", "Please send any changes prior to departure.", "prior to", "", "tourism,work", "personal"),
    ("proportion", "C1", "noun", "pro-por-tion", 1, "a part of a whole, or the relationship between sizes", "A large proportion of her work is checking emails.", "a large proportion of", "", "everyday", "starter"),
    ("reluctant", "C1", "adjective", "re-luc-tant", 1, "not wanting to do something", "The guest was reluctant to change hotels at the last minute.", "reluctant to", "", "everyday", "starter"),
    ("relevant", "C1", "adjective", "rel-e-vant", 0, "closely connected to the subject", "Please include only the relevant times in the voucher.", "relevant to", "", "work", "starter"),
    ("surcharge", "C1", "noun", "sur-charge", 0, "an extra amount of money you must pay", "A late check-out may include a small surcharge.", "a surcharge for", "", "tourism", "personal"),
    ("sustain", "C1", "verb", "sus-tain", 1, "to keep something going over time", "Regular practice helps sustain her English.", "sustain a habit", "", "everyday", "starter"),
    ("thorough", "C1", "adjective", "thor-ough", 0, "complete and careful", "A thorough check of the names will prevent a problem at the airport.", "a thorough check", "", "work", "starter"),
    ("undertake", "C1", "verb", "un-der-take", 0, "to start a task and accept responsibility for it", "She will undertake the booking changes this afternoon.", "undertake a task", "", "work", "starter"),
    ("virtually", "C1", "adverb", "vir-tu-al-ly", 0, "almost, or done by computer rather than in person", "The job is virtually all done from home.", "virtually all", "", "work", "starter"),
    ("widespread", "C1", "adjective", "wide-spread", 0, "happening or existing in many places", "Delays were widespread after the storm.", "", "", "everyday", "starter"),
    ("allocate", "C1", "verb", "al-lo-cate", 0, "to give a share of something for a purpose", "The hotel will allocate a quiet room at the back.", "allocate a room", "", "tourism", "personal"),
    ("capability", "C1", "noun", "ca-pa-bil-i-ty", 2, "the power or skill to do something", "The team has the capability to change a complex itinerary quickly.", "", "capable", "work", "starter"),
    ("coherent", "C1", "adjective", "co-her-ent", 1, "clear, logical, and well organised", "The itinerary should tell one coherent story of the week.", "a coherent plan", "", "work", "starter"),
    ("compensate", "C1", "verb", "com-pen-sate", 1, "to give money or something else for a loss or problem", "The airline will compensate the guest with a voucher.", "compensate for", "", "tourism", "starter"),
    ("concise", "C1", "adjective", "con-cise", 1, "short and clear, without wasted words", "Please keep the email concise and polite.", "a concise email", "", "work", "starter"),
    ("constraint", "C1", "noun", "con-straint", 1, "a limit on what you can do", "The only constraint is the early train the next morning.", "a time constraint", "", "work", "starter"),
    ("convey", "C1", "verb", "con-vey", 1, "to communicate an idea or a feeling", "A short, kind email can convey the change clearly.", "convey a message", "", "work", "starter"),
    ("criteria", "C1", "noun", "cri-te-ri-a", 1, "the standards you use to judge something", "Price and quiet are the main criteria for this booking.", "the criteria for", "", "work", "starter"),
    ("duration", "C1", "noun", "du-ra-tion", 1, "the length of time something lasts", "The duration of the stay is four nights.", "the duration of", "", "tourism", "personal"),
    ("priority", "C1", "noun", "pri-or-i-ty", 1, "something that is more important than other things", "A correct name on the ticket is the first priority.", "a high priority", "", "work", "starter"),
    ("clarify", "C1", "verb", "clar-i-fy", 0, "to make something easier to understand", "I emailed the hotel to clarify the check-in time.", "clarify a detail", "", "work", "starter"),
    ("outcome", "C1", "noun", "out-come", 0, "the final result of a process or a situation", "The outcome was a later flight and a complimentary seat.", "the final outcome", "", "work", "starter"),
    ("procedure", "C1", "noun", "pro-ce-dure", 1, "the official or usual way of doing something", "The check-in procedure is explained on the voucher.", "a standard procedure", "", "work", "starter"),
    # C2
    ("allotment", "C2", "noun", "al-lot-ment", 1, "an amount of something reserved or given for a purpose", "The hotel is holding an allotment of ten rooms for the group.", "a room allotment", "allocate", "tourism", "personal"),
    ("ambiguity", "C2", "noun", "am-bi-gu-i-ty", 2, "the state of having more than one possible meaning", "The time in the email had some ambiguity, so I asked for confirmation.", "", "ambiguous", "work", "starter"),
    ("analogous", "C2", "adjective", "a-nal-o-gous", 1, "similar in a way that helps you compare two things", "A hotel allotment is analogous to a block of reserved seats on a train.", "analogous to", "", "everyday", "starter"),
    ("arbitrary", "C2", "adjective", "ar-bi-trar-y", 0, "based on chance or personal choice, not on a clear rule", "The extra fee seemed arbitrary, so she asked the hotel to explain it.", "an arbitrary decision", "", "everyday", "starter"),
    ("assertion", "C2", "noun", "as-ser-tion", 1, "a strong statement that something is true", "His assertion that the room was prepaid was correct.", "an assertion that", "", "work", "starter"),
    ("compile", "C2", "verb", "com-pile", 1, "to collect information and put it together", "She will compile the vouchers into one file for the driver.", "compile a list", "", "work", "starter"),
    ("conceivable", "C2", "adjective", "con-ceiv-a-ble", 1, "possible to imagine or believe", "It is conceivable that the train will be late after the storm.", "every conceivable option", "", "everyday", "starter"),
    ("confer", "C2", "verb", "con-fer", 1, "to discuss something in order to decide, or to give an official title", "I need to confer with the hotel before I change the dates.", "confer with", "", "work", "starter"),
    ("culminate", "C2", "verb", "cul-mi-nate", 0, "to reach the highest or final point", "The trip will culminate in a family dinner in the village.", "culminate in", "", "everyday", "starter"),
    ("defer", "C2", "verb", "de-fer", 1, "to delay something until a later time", "We should defer the booking until the new timetable is published.", "defer a decision", "", "work", "personal"),
    ("denote", "C2", "verb", "de-note", 1, "to be a sign of something, or to mean something", "The red mark on the itinerary denotes a prepaid service.", "denote a change", "", "work", "starter"),
    ("discern", "C2", "verb", "dis-cern", 1, "to notice or recognise something that is not obvious", "It was hard to discern the correct terminal from the first email.", "discern a difference", "", "everyday", "starter"),
    ("disparity", "C2", "noun", "dis-par-i-ty", 1, "a large difference, especially an unfair one", "There was a disparity between the price on the website and the invoice.", "a disparity between", "", "work", "starter"),
    ("disseminate", "C2", "verb", "dis-sem-i-nate", 1, "to spread information widely", "Please disseminate the new departure time to every guest in the group.", "disseminate information", "", "work", "starter"),
    ("domain", "C2", "noun", "do-main", 1, "an area of knowledge, activity, or control", "Hotel reservations are her main domain at work.", "in the domain of", "", "work", "starter"),
    ("elicit", "C2", "verb", "e-lic-it", 1, "to get information or a reaction from someone", "A short question will elicit the check-in time from the hotel.", "elicit a reply", "", "work", "starter"),
    ("empirical", "C2", "adjective", "em-pir-i-cal", 1, "based on real experience and evidence, not only on theory", "We have empirical evidence that earlier transfers miss less traffic.", "empirical evidence", "", "everyday", "starter"),
    ("exemplify", "C2", "verb", "ex-em-pli-fy", 1, "to be a typical example of something", "This quiet village stay exemplifies the kind of trip she loves.", "exemplify a style", "", "everyday", "starter"),
    ("exhaustive", "C2", "adjective", "ex-haus-tive", 1, "complete, including everything", "The email was not an exhaustive list of every optional tour.", "an exhaustive list", "", "work", "starter"),
    ("facet", "C2", "noun", "fac-et", 0, "one side or aspect of something", "Pronunciation is only one facet of learning a word.", "a facet of", "", "everyday", "starter"),
    ("idiosyncrasy", "C2", "noun", "id-i-o-syn-cra-sy", 3, "a strange habit or unusual feature of one person or thing", "One idiosyncrasy of this hotel is that check-in is only after three.", "", "", "everyday", "starter"),
    ("incumbent", "C2", "adjective", "in-cum-bent", 1, "necessary as a duty, or describing the person who currently has a role", "It is incumbent on us to confirm the names before we issue tickets.", "incumbent on", "", "work", "starter"),
    ("inherent", "C2", "adjective", "in-her-ent", 1, "existing as a natural part of something", "Some risk is inherent in a tight train connection.", "inherent in", "", "everyday", "starter"),
    ("integral", "C2", "adjective", "in-te-gral", 0, "necessary as a part of a whole", "A clear voucher is an integral part of the arrival plan.", "an integral part of", "", "work", "starter"),
    ("invariably", "C2", "adverb", "in-var-i-a-bly", 1, "always, without changing", "The first email of the day is invariably about a time change.", "", "", "everyday", "starter"),
    ("mandate", "C2", "noun", "man-date", 0, "an official order or authority to do something", "She does not have a mandate to offer a refund without approval.", "a mandate to", "", "work", "starter"),
    ("negligible", "C2", "adjective", "neg-li-gi-ble", 0, "so small that it is not worth considering", "The walk from the room to the beach is negligible.", "a negligible delay", "", "everyday", "starter"),
    ("nuance", "C2", "noun", "nu-ance", 0, "a very small difference in meaning, feeling, or colour", "She is learning the nuance between reserved and booked.", "a subtle nuance", "", "everyday", "personal"),
    ("paradox", "C2", "noun", "par-a-dox", 0, "a situation that seems impossible because it has two opposite sides", "It is a paradox that working from home can feel both quieter and busier.", "", "", "everyday", "starter"),
    ("paramount", "C2", "adjective", "par-a-mount", 1, "more important than anything else", "Guest safety is paramount when we choose a transfer.", "of paramount importance", "", "tourism", "starter"),
    ("pertinent", "C2", "adjective", "per-ti-nent", 0, "directly related to the matter being discussed", "The most pertinent detail is the real departure time, not the old one.", "pertinent to", "", "work", "starter"),
    ("plethora", "C2", "noun", "pleth-o-ra", 0, "a large amount, more than you need", "The inbox had a plethora of similar questions about breakfast times.", "a plethora of", "", "everyday", "starter"),
    ("prerequisite", "C2", "noun", "pre-req-ui-site", 1, "something required before something else can happen", "A confirmed room is a prerequisite for issuing the voucher.", "a prerequisite for", "", "work", "starter"),
    ("presumably", "C2", "adverb", "pre-sum-a-bly", 1, "used when you think something is likely", "The driver is late, presumably because of the rain.", "", "", "everyday", "starter"),
    ("proximity", "C2", "noun", "prox-im-i-ty", 1, "nearness in space or time", "The house is in close proximity to her parents home.", "in close proximity to", "", "hometown,family", "personal"),
    ("reconcile", "C2", "verb", "rec-on-cile", 0, "to make two different ideas or facts fit together in a satisfactory way", "I need to reconcile the times on the voucher with the airline email.", "reconcile a difference", "", "work", "starter"),
    ("respective", "C2", "adjective", "re-spec-tive", 1, "belonging separately to each of the people or things just named", "Please send each guest to their respective hotels.", "their respective rooms", "", "work", "starter"),
    ("scrutinise", "C2", "verb", "scru-ti-nise", 0, "to look at something very carefully", "She will scrutinise the names on the ticket before she sends it.", "scrutinise a document", "", "work", "starter"),
    ("seemingly", "C2", "adverb", "seem-ing-ly", 0, "in a way that appears to be true, though it may not be", "A seemingly small typo can block a passenger at check-in.", "", "", "work", "starter"),
    ("subsequently", "C2", "adverb", "sub-se-quent-ly", 1, "later, after something else", "The flight was cancelled and subsequently replaced with a later one.", "", "", "work", "starter"),
    ("substantiate", "C2", "verb", "sub-stan-ti-ate", 2, "to provide evidence that something is true", "The confirmation email will substantiate the prepaid stay.", "substantiate a claim", "", "work", "starter"),
    ("tacit", "C2", "adjective", "tac-it", 0, "understood without being said", "There was a tacit agreement that the driver would wait twenty minutes.", "tacit agreement", "", "everyday", "starter"),
    ("underpin", "C2", "verb", "un-der-pin", 0, "to support or form the basis of something", "Clear emails underpin a calm arrival for every guest.", "underpin a plan", "", "work", "starter"),
    ("courtesy", "C2", "noun", "cour-te-sy", 0, "polite behaviour, or a polite action given freely", "The fruit basket was a courtesy from the hotel, not part of the paid package.", "a courtesy of", "complimentary", "tourism", "personal"),
    ("discrepancy", "C2", "noun", "dis-crep-an-cy", 1, "a difference between two things that should be the same", "There was a discrepancy between the voucher and the hotel list.", "a discrepancy between", "", "tourism,work", "personal"),
    ("notwithstanding", "C2", "preposition", "not-with-stand-ing", 2, "in spite of", "Notwithstanding the delay, the guests still reached the hotel for dinner.", "", "", "everyday", "starter"),
    ("repertoire", "C2", "noun", "rep-er-toire", 0, "the set of skills or pieces a person can perform or use", "She is adding work phrases to her English repertoire.", "a wide repertoire", "", "everyday", "starter"),
    ("hitherto", "C2", "adverb", "hith-er-to", 0, "until now", "The hitherto quiet season has suddenly become busy.", "", "", "everyday", "starter"),
    ("qualitative", "C2", "adjective", "qual-i-ta-tive", 2, "relating to the quality of something, not only the amount", "We need qualitative comments from the guest, not only a score.", "qualitative feedback", "", "work", "starter"),
    ("whereby", "C2", "adverb", "where-by", 1, "by which, or according to which", "They use a simple system whereby every change is confirmed in writing.", "a system whereby", "", "work", "starter"),
]

PAIRS = [
    # th
    ("think-sink", "A1", "th", "think", "to use your mind", "I think the room is ready.", "sink", "to go down under water", "Do not let the phone sink in the water."),
    ("they-day", "A1", "th", "they", "the people already mentioned", "They arrive tonight.", "day", "a period of twenty-four hours", "Have a nice day at the beach."),
    ("three-tree", "A1", "th", "three", "the number 3", "We need three tickets.", "tree", "a tall plant with a wooden trunk", "There is a tree in front of the house."),
    ("thank-tank", "A2", "th", "thank", "to tell someone you are grateful", "I want to thank the driver.", "tank", "a large container for liquid", "The water tank is on the roof."),
    ("thin-tin", "A2", "th", "thin", "not thick, with little distance between the sides", "The walls in this room are thin.", "tin", "a metal container for food or drink", "Please open a tin of fruit."),
    ("thick-sick", "B1", "th", "thick", "not thin, with a large distance between the sides", "The walls of the old house are thick.", "sick", "not well, ill", "He felt sick after the long bus ride."),
    ("thirty-thirteen", "B1", "th", "thirty", "the number 30", "The transfer takes about thirty minutes.", "thirteen", "the number 13", "The train leaves from platform thirteen."),
    ("both-boat", "B1", "th", "both", "the two things or people, not only one", "Both rooms are prepaid.", "boat", "a vehicle that travels on water", "They took a boat to the island."),
    # s / sh
    ("see-she", "A1", "s-sh", "see", "to notice with your eyes", "I can see the beach from here.", "she", "a woman or girl already mentioned", "She works from home."),
    ("sip-ship", "A1", "s-sh", "sip", "to drink a very small amount", "She took a sip of coffee.", "ship", "a large boat for sea travel", "The ship leaves in the evening."),
    ("seat-sheet", "A2", "s-sh", "seat", "a place to sit", "Please keep this seat for the child.", "sheet", "a large piece of cloth for a bed, or a piece of paper", "There is a clean sheet on the bed."),
    ("save-shave", "A2", "s-sh", "save", "to keep someone or something safe, or to keep money", "This copy will save the booking details.", "shave", "to cut hair from the skin with a razor", "He wants to shave before dinner."),
    ("sell-shell", "A2", "s-sh", "sell", "to give something in exchange for money", "They sell fruit at the market.", "shell", "the hard outer part of some sea animals or eggs", "The child found a shell on the beach."),
    ("sock-shock", "B1", "s-sh", "sock", "a piece of clothing for the foot", "Pack a warm sock for the mountain night.", "shock", "a sudden, strong, unpleasant surprise", "The cancelled flight was a shock."),
    ("class-clash", "B1", "s-sh", "class", "a group of students, or a level of quality", "They booked a first-class seat.", "clash", "a short fight, or a serious disagreement of times or colours", "The two tours clash on Friday morning."),
    ("sign-shine", "B2", "s-sh", "sign", "a notice that gives information, or a movement that has a meaning", "Follow the sign to the station.", "shine", "to give out light, or to be bright", "The sun will shine on the rice field."),
    # clusters
    ("flight-fight", "A2", "cluster", "flight", "a journey in a plane", "The flight is fully prepaid.", "fight", "an act of arguing or hitting, or an effort against something", "Please do not fight about the window seat."),
    ("street-seat", "A2", "cluster", "street", "a road in a town with buildings along it", "The hotel is on a quiet street.", "seat", "a place to sit", "There is a seat by the window."),
    ("play-pray", "A1", "cluster", "play", "to take part in a game, or to make music", "The children play in the garden.", "pray", "to speak to a god, often to ask for help", "They pray in the morning."),
    ("blue-brew", "B1", "cluster", "blue", "the colour of a clear sky", "The sea is a deep blue this morning.", "brew", "to make tea or coffee with hot water", "I will brew a pot of tea."),
    ("pressed-pest", "B2", "cluster", "pressed", "pushed firmly, or busy and short of time", "She pressed the button for the next floor.", "pest", "an insect or animal that causes damage", "A pest in the rice field can ruin the crop."),
    ("cloud-crowd", "A2", "cluster", "cloud", "a white or grey mass in the sky", "There is no cloud in the sky today.", "crowd", "a large group of people in one place", "A crowd waited at the station."),
    # finals and endings
    ("book-booked", "A1", "ending", "book", "to arrange to have a room, seat, or ticket later", "I will book a room tonight.", "booked", "already reserved, or reserved in the past", "The room is already booked."),
    ("reserve-reserved", "B1", "ending", "reserve", "to arrange to keep something for later", "Please reserve a quiet table.", "reserved", "kept for someone, or booked already", "The table is reserved for seven o clock."),
    ("flight-flights", "A1", "ending", "flight", "a journey in a plane", "The flight leaves at six.", "flights", "more than one journey in a plane", "She books flights every week."),
    ("walk-walked", "A1", "ending", "walk", "to move on your feet at a normal speed", "We walk to the neighbours house.", "walked", "moved on your feet in the past", "We walked to the rice field yesterday."),
    ("want-wanted", "A1", "ending", "want", "to wish to have or do something", "I want a window seat.", "wanted", "wished to have or do something in the past", "They wanted a later transfer."),
    ("watch-watches", "A2", "ending", "watch", "to look at something for a period of time, or a small clock you wear", "They watch the sunset from the balcony.", "watches", "looks at something, or more than one small clock", "He watches the departure board."),
    ("guest-guessed", "B1", "ending", "guest", "a person who visits you or stays in a hotel", "The guest is waiting in the lobby.", "guessed", "gave an answer without being sure it was right", "I guessed the arrival time and I was wrong."),
    ("place-plays", "A2", "ending", "place", "a particular area, building, or position", "This village is a quiet place to stay.", "plays", "takes part in a game, or theatre performances", "She plays with the children at the weekend."),
    ("close-clothes", "B1", "ending", "close", "to shut something, or not far", "Please close the door.", "clothes", "the things you wear", "Pack light clothes for the warm weather."),
    ("rice-rise", "A2", "final", "rice", "a grain that is a common food", "The rice field is behind the house.", "rise", "to go up, or to get up", "The sun will rise early over the village."),
    ("life-live", "B1", "final", "life", "the time a person is alive, or the way a person lives", "She has a better work-life balance now.", "live", "to have your home in a place, or happening now", "They live in a small village."),
    ("bus-buzz", "A2", "final", "bus", "a large vehicle that many people ride", "The bus stops outside the hotel.", "buzz", "a low continuous sound, like a bee", "I could hear the buzz of the market."),
    # vowels that often collapse
    ("ship-sheep", "A1", "vowel", "ship", "a large boat for sea travel", "The ship leaves in the evening.", "sheep", "a farm animal kept for wool or meat", "There are sheep near the rice field."),
    ("sit-seat", "A1", "vowel", "sit", "to rest with your body on a chair", "Please sit by the window.", "seat", "a place to sit", "This seat is reserved."),
    ("live-leave", "A2", "vowel", "live", "to have your home in a place", "They live in central Vietnam.", "leave", "to go away from a place", "We leave the hotel at eight."),
    ("bad-bed", "A1", "vowel", "bad", "not good, or of low quality", "A bad delay ruined the first morning.", "bed", "a piece of furniture you sleep on", "The bed in the room is comfortable."),
    ("hat-hot", "A1", "vowel", "hat", "a piece of clothing you wear on your head", "Take a hat for the sunny walk.", "hot", "having a high temperature", "The countryside is quite hot at noon."),
    ("full-fool", "B1", "vowel", "full", "containing as much as possible, or complete", "The morning flight is already full.", "fool", "a person who acts in a silly way, or to trick someone", "Do not let a wrong time fool you."),
    ("pool-pull", "A2", "vowel", "pool", "a place made for people to swim", "The hotel has a small pool.", "pull", "to move something toward you", "Please pull the door, do not push it."),
]


def slug(lemma: str) -> str:
    return lemma.lower().replace(" ", "-")


def expand_words() -> list[dict]:
    out = []
    seen = set()
    for lemma, level, pos, syllables, stress, gloss, example, colloc, family, tags, source in RAW:
        wid = slug(lemma)
        if wid in seen:
            wid = f"{wid}-{pos[:1]}"
        seen.add(wid)
        out.append({
            "id": wid,
            "lemma": lemma,
            "level": level,
            "ipa": "",
            "audioUrl": "",
            "syllables": [s for s in syllables.split("-") if s],
            "stressIndex": int(stress),
            "pos": pos,
            "gloss": gloss,
            "examples": [example],
            "collocations": [c.strip() for c in colloc.split(",") if c.strip()],
            "family": [f.strip() for f in family.split(",") if f.strip()],
            "pairs": [],
            "tags": [t.strip() for t in tags.split(",") if t.strip()],
            "source": source,
        })
    return out


def expand_pairs() -> list[dict]:
    out = []
    for pid, level, pitfall, a, a_gloss, a_sent, b, b_gloss, b_sent in PAIRS:
        out.append({
            "id": pid,
            "level": level,
            "pitfall": pitfall,
            "a": {"lemma": a, "ipa": "", "gloss": a_gloss},
            "b": {"lemma": b, "ipa": "", "gloss": b_gloss},
            "sentenceA": a_sent,
            "sentenceB": b_sent,
        })
    return out


FALLBACK_IPA = {
    "please": "/pliːz/",
    "check-in": "/ˈtʃɛkɪn/",
    "countryside": "/ˈkʌntrisaɪd/",
    "hometown": "/ˈhəʊmtaʊn/",
    "sightseeing": "/ˈsaɪtsiːɪŋ/",
    "prepaid": "/ˌpriːˈpeɪd/",
    "overbook": "/ˌəʊvəˈbʊk/",
    "work-life": "/ˈwɜːklaɪf/",
    "minimise": "/ˈmɪnɪmaɪz/",
    "scrutinise": "/ˈskruːtənaɪz/",
    "neighbour": "/ˈneɪbə/",
    "itinerary": "/aɪˈtɪnərəri/",
    "accommodation": "/əˌkɒməˈdeɪʃn/",
    "complimentary": "/ˌkɒmplɪˈmentəri/",
    "surcharge": "/ˈsɜːtʃɑːdʒ/",
    "allotment": "/əˈlɒtmənt/",
    "notwithstanding": "/ˌnɒtwɪθˈstændɪŋ/",
    "idiosyncrasy": "/ˌɪdiəˈsɪŋkrəsi/",
    "booked": "/bʊkt/",
    "reserved": "/rɪˈzɜːvd/",
    "flights": "/flaɪts/",
    "walked": "/wɔːkt/",
    "wanted": "/ˈwɒntɪd/",
    "watches": "/ˈwɒtʃɪz/",
    "guessed": "/ɡest/",
    "plays": "/pleɪz/",
    "clothes": "/kləʊðz/",
    "thirteen": "/ˌθɜːˈtiːn/",
    "thirty": "/ˈθɜːti/",
    "pressed": "/prest/",
}


def fetch_ipa(term: str, timeout: float = 8.0) -> str:
    key = term.split()[0]
    url = "https://api.dictionaryapi.dev/api/v2/entries/en/" + urllib.request.quote(key)
    req = urllib.request.Request(url, headers={"User-Agent": "WordDuo/1.0 (educational; github.com/TanDao01262000/word-duo)"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return ""
    if not data:
        return ""
    entry = data[0]
    ipa = entry.get("phonetic") or ""
    if not ipa:
        for p in entry.get("phonetics") or []:
            if p.get("text"):
                ipa = p["text"]
                break
    ipa = (ipa or "").strip()
    if ipa and not ipa.startswith("/"):
        ipa = f"/{ipa.strip('/')}/"
    return ipa


def collect_terms(words: list[dict], pairs: list[dict]) -> set[str]:
    terms: set[str] = set()
    for w in words:
        terms.add(w["lemma"])
    for p in pairs:
        terms.add(p["a"]["lemma"])
        terms.add(p["b"]["lemma"])
    return terms


def fill_ipa(words: list[dict], pairs: list[dict], cache: dict[str, str]) -> None:
    terms = sorted(collect_terms(words, pairs))
    missing = [t for t in terms if not cache.get(t)]
    print(f"IPA cache has {len(terms) - len(missing)}/{len(terms)}; fetching {len(missing)}")
    for i, term in enumerate(missing, 1):
        ipa = FALLBACK_IPA.get(term, "") or fetch_ipa(term)
        if not ipa:
            ipa = FALLBACK_IPA.get(term, "")
        cache[term] = ipa
        print(f"  [{i}/{len(missing)}] {term} -> {ipa or 'NONE'}")
        time.sleep(0.25)
    for w in words:
        w["ipa"] = cache.get(w["lemma"], "") or FALLBACK_IPA.get(w["lemma"], "")
    for p in pairs:
        p["a"]["ipa"] = cache.get(p["a"]["lemma"], "") or FALLBACK_IPA.get(p["a"]["lemma"], "")
        p["b"]["ipa"] = cache.get(p["b"]["lemma"], "") or FALLBACK_IPA.get(p["b"]["lemma"], "")


def link_pairs(words: list[dict], pairs: list[dict]) -> None:
    by_lemma: dict[str, dict] = {w["lemma"]: w for w in words}
    for p in pairs:
        for side in ("a", "b"):
            w = by_lemma.get(p[side]["lemma"])
            if w and p["id"] not in w["pairs"]:
                w["pairs"].append(p["id"])


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    data_dir = root / "data"
    data_dir.mkdir(exist_ok=True)
    words = expand_words()
    pairs = expand_pairs()
    from collections import Counter
    counts = Counter(w["level"] for w in words)
    personal = sum(1 for w in words if w["source"] == "personal")
    print("words", len(words), dict(counts), "personal", personal, "pairs", len(pairs))
    cache_path = data_dir / "ipa-cache.json"
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    fill_ipa(words, pairs, cache)
    cache_path.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n")
    link_pairs(words, pairs)
    (data_dir / "words.json").write_text(json.dumps(words, indent=2, ensure_ascii=False) + "\n")
    (data_dir / "pairs.json").write_text(json.dumps(pairs, indent=2, ensure_ascii=False) + "\n")
    missing = [w["lemma"] for w in words if not w["ipa"]] + [
        f"{p['id']}:{side}" for p in pairs for side in ("a", "b") if not p[side]["ipa"]
    ]
    print("missing IPA", missing)


if __name__ == "__main__":
    main()
