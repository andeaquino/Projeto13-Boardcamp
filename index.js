import express from 'express';
import pg from 'pg';
import Joi from 'joi';
import dayjs from 'dayjs';

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
const rentalSchema = Joi.object({
  customerId: Joi.number().required(),
  gameId: Joi.number().required(),
  daysRented: Joi.number().min(1).required()
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
    const games = await connection.query(`
      SELECT 
        games.*, 
        categories.name AS "categoryName" 
      FROM games 
      JOIN categories 
        ON games."categoryId"=categories.id 
      WHERE LOWER(games.name) LIKE LOWER($1)
    ;`, [name + '%']);
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

    await connection.query(`
      INSERT INTO games (
        name, 
        image, 
        "stockTotal", 
        "categoryId", 
        "pricePerDay"
      ) 
      VALUES ($1, $2, $3, $4, $5)
    ;`, [name, image, stockTotal, categoryId, pricePerDay]);
    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  }
});

app.get('/customers', async (req, res) => {
  const cpf = req.query.cpf ? req.query.cpf : "";

  try {
    const customersResult = await connection.query(`SELECT * FROM customers WHERE cpf LIKE $1;`, [cpf + '%']);
    const customers = customersResult.rows.map(customer => {
      return {
        ...customer,
        birthday: dayjs(customer.birthday).format('YYYY-MM-DD')
      }
    })

    res.send(customers).status(200);
  } catch {
    res.sendStatus(500);
  }
});

app.get('/customers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const customersResult = await connection.query(`SELECT * FROM customers WHERE id = $1;`, [id]);
    if (customersResult.rows.length === 0) {
      res.sendStatus(404);
      return;
    }
    const customers = customersResult.rows.map(customer => {
      return {
        ...customer,
        birthday: dayjs(customer.birthday).format('YYYY-MM-DD')
      }
    })

    res.send(customers[0]).status(200);
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

app.get('/rentals', async (req, res) => {
  const customerId = req.query.customerId ? req.query.customerId : 0;
  const gameId = req.query.gameId ? req.query.gameId : 0;

  try {
    const rentalsResult = await connection.query(`
      SELECT 
        rentals.*, 
        customers.id AS "idCustomer", 
        customers.name AS "nameCustomer", 
        games.id AS "idGame", 
        games.name AS "nameGame", 
        games."categoryId", 
        categories.name AS "categoryName"
      FROM rentals 
      JOIN customers 
        ON customers.id = rentals."customerId" 
      JOIN games 
        ON games.id = rentals."gameId" 
      JOIN categories 
        ON categories.id = games."categoryId"
      WHERE 
        rentals."customerId" = (
          CASE WHEN $1 = 0 THEN
            rentals."customerId"
          ELSE
            $1
          END
        )
      AND 
        rentals."gameId" = (
          CASE WHEN $2 = 0 THEN
            rentals."gameId"
          ELSE
            $2
          END
        )
    ;`, [customerId, gameId]);

    const rentals = rentalsResult.rows.map(rental => {
      return {
        id: rental.id,
        customerId: rental.customerId,
        gameId: rental.gameId,
        rentDate: dayjs(rental.rentDate).format('YYYY-MM-DD'),
        daysRented: rental.daysRented,
        returnDate: rental.returnDate ? dayjs(rental.returnDate).format('YYYY-MM-DD') : rental.returnDate,
        originalPrice: rental.originalPrice,
        delayFee: rental.delayFee,
        customer: {
          id: rental.idCustomer,
          name: rental.nameCustomer
        },
        game: {
          id: rental.idGame,
          name: rental.nameGame,
          categoryId: rental.categoryId,
          categoryName: rental.categoryName
        }
      }
    });

    res.send(rentals).status(200);
  } catch {
    res.sendStatus(500);
  }
});

app.post('/rentals', async (req, res) => {
  const { customerId, gameId, daysRented } = req.body;

  try {
    if (rentalSchema.validate({customerId, gameId, daysRented}).error) {
      return res.sendStatus(400);
    }

    const customerCheck = await connection.query('SELECT * FROM customers WHERE id = $1;', [customerId]);
    if (customerCheck.rows.length === 0) {
      return res.sendStatus(400);
    }

    const gameCheck = await connection.query('SELECT * FROM games WHERE id = $1;', [gameId]);
    if (gameCheck.rows.length === 0) {
      return res.sendStatus(400);
    }

    const stock = gameCheck.rows[0].stockTotal;
    const totalRentals = await connection.query(`SELECT * FROM rentals WHERE "gameId" = $1 AND "returnDate" is null;`, [gameId]);
    if (stock === totalRentals.rows.length) {
      return res.sendStatus(400);
    }

    const pricePerDay = gameCheck.rows[0].pricePerDay;
    const rentDate = dayjs().format('YYYY-MM-DD');
    const originalPrice = pricePerDay * daysRented;

    await connection.query(`
      INSERT INTO rentals (
        "customerId", 
        "gameId", 
        "rentDate", 
        "daysRented", 
        "returnDate", 
        "originalPrice", 
        "delayFee"
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    ;`, [customerId, gameId, rentDate, daysRented, null, originalPrice, null]);
    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  }
});

app.post('/rentals/:id/return', async (req, res) => {
  const { id } = req.params;

  try {
    const rentalCheck = await connection.query('SELECT * FROM rentals WHERE id = $1;', [id]);
    if (rentalCheck.rows.length === 0) {
      return res.sendStatus(404);
    }

    if (rentalCheck.rows[0].returnDate !== null) {
      return res.sendStatus(400);
    }

    const pricePerDay = rentalCheck.rows[0].originalPrice / rentalCheck.rows[0].daysRented;
    const daysRented = rentalCheck.rows[0].daysRented;
    const rentDate = rentalCheck.rows[0].rentDate;
    const returnDate = dayjs().format('YYYY-MM-DD');
    const delayFee = Math.max((dayjs(returnDate).diff(rentDate, 'day') - daysRented) * pricePerDay, 0);

    await connection.query(`UPDATE rentals SET "returnDate" = $2, "delayFee" = $3 WHERE id = $1;`, [id, returnDate, delayFee]);
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

app.delete('/rentals/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const idCheck = await connection.query('SELECT * FROM rentals WHERE id = $1;', [id]);
    if (idCheck.rows.length === 0) {
      return res.sendStatus(404);
    }

    if (idCheck.rows[0].returnDate !== null) {
      return res.sendStatus(400);
    }

    await connection.query(`DELETE FROM rentals WHERE id = $1;`, [id]);
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

app.listen(4000);