import express from 'express';
import pg from 'pg';
import Joi from 'joi';

const { Pool } = pg;

const connection = new Pool({
  user: 'bootcamp_role',
  host: 'localhost',
  port: 5432,
  database: 'boardcamp',
  password: 'senha_super_hiper_ultra_secreta_do_role_do_bootcamp'
});

const categorySchema = Joi.object({
  name: Joi.string().required()
});
const gameSchema = Joi.object({
  name: Joi.string().required(),
  stockTotal: Joi.number().min(1).required(),
  pricePerDay: Joi.number().min(1).required()
});
const customerSchema = Joi.object({
  name: Joi.string().required(),
  phone: Joi.string().pattern(/^[0-9]{10,11}$/).required(),
  cpf: Joi.string().pattern(/^[0-9]{11}$/).required(),
  birthday: Joi.string().pattern(/^\d{4}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01])$/).required()
});

const app = express();
app.use(express.json());

app.get('/categories', async (req, res) => {
  try {
    const categories = await connection.query('SELECT * FROM categories;');
    res.send(categories.rows).status(200);
  } catch {
    res.sendStatus(500);
  }
});

app.post('/categories', async (req, res) => {
  const { name } = req.body;

  try {
    const categoryCheck = await connection.query('SELECT * FROM categories WHERE name = $1;', [name]);

    if (categoryCheck.rows.length !== 0) {
      return res.sendStatus(409);
    }
  
    if (categorySchema.validate({name}).error) {
      return res.sendStatus(400);
    }

    await connection.query('INSERT INTO categories (name) VALUES ($1);', [name]);
    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  }
});

app.get('/games', async (req, res) => {
  const name = req.query.name ? req.query.name : "";

  try {
    const games = await connection.query(`SELECT games.*, categories.name AS "categoryName" FROM games JOIN categories ON games."categoryId"=categories.id WHERE LOWER(categories.name) LIKE $1;`, [name + '%']);
    res.send(games.rows).status(200);
  } catch {
    res.sendStatus(500);
  }
});

app.post('/games', async (req, res) => {
  const { name, image, stockTotal, categoryId, pricePerDay } = req.body;

  try {
    const categoryCheck = await connection.query('SELECT * FROM categories WHERE id = $1;', [categoryId]);
    if (categoryCheck.rows.length === 0 || gameSchema.validate({name, stockTotal, pricePerDay}).error) {
      return res.sendStatus(400);
    }

    const nameCheck = await connection.query('SELECT * FROM games WHERE name = $1;', [name]);
    if (nameCheck.rows.length !== 0) {
      return res.sendStatus(409);
    }

    await connection.query(`INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5);`, [name, image, stockTotal, categoryId, pricePerDay]);
    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  }
});

app.get('/customers', async (req, res) => {
  const cpf = req.query.cpf ? req.query.cpf : "";

  try {
    const customers = await connection.query(`SELECT * FROM customers WHERE cpf LIKE $1;`, [cpf + '%']);
    res.send(customers.rows).status(200);
  } catch {
    res.sendStatus(500);
  }
});

app.get('/customers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const customers = await connection.query(`SELECT * FROM customers WHERE id = $1;`, [id]);
    if (customers.rows.length === 0) {
      res.sendStatus(404);
      return;
    }
    res.send(customers.rows[0]).status(200);
  } catch {
    res.sendStatus(500);
  }
});

app.post('/customers', async (req, res) => {
  const { name, phone, cpf, birthday } = req.body;

  try {
    if (customerSchema.validate({name, phone, cpf, birthday}).error) {
      return res.sendStatus(400);
    }

    const cpfCheck = await connection.query('SELECT * FROM customers WHERE cpf = $1;', [cpf]);
    if (cpfCheck.rows.length !== 0) {
      return res.sendStatus(409);
    }

    await connection.query(`INSERT INTO customers (name, phone, cpf, birthday) VALUES ($1, $2, $3, $4);`, [name, phone, cpf, birthday]);
    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  }
});

app.put('/customers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, cpf, birthday } = req.body;

  try {
    if (customerSchema.validate({name, phone, cpf, birthday}).error) {
      return res.sendStatus(400);
    }

    const cpfCheck = await connection.query('SELECT * FROM customers WHERE cpf = $1;', [cpf]);
    if (cpfCheck.rows.length !== 0 && cpfCheck.rows[0].id !== Number(id)) {
      return res.sendStatus(409);
    }

    await connection.query(`UPDATE customers SET name = $2, phone = $3, cpf = $4, birthday = $5 WHERE id = $1;`, [id, name, phone, cpf, birthday]);
    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  }
});

app.listen(4000);