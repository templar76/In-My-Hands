import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import Layout from '../components/Layout';
import store from '../store';

test('renders AppBar title In My Hands', () => {
  render(
    <Provider store={store}>
      <MemoryRouter>
        <Layout>
          <div>Contenuto di Test</div>
        </Layout>
      </MemoryRouter>
    </Provider>
  );
  expect(screen.getByText(/In My Hands/i)).toBeInTheDocument();
});
