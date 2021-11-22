export type ServerMessage = {
  type: 'update';
  module_string: string;
  sourceURL: string;
};

export type ClientMessage = { type: 'register'; client_id: string };
