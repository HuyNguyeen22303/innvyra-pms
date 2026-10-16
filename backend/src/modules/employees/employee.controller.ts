import type { Request, RequestHandler } from 'express';
import { requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import type { EmployeeService } from './employee.service.js';
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeQuery,
  EmployeeScope,
} from './employee.types.js';

function scope(req: Request): EmployeeScope {
  const { user } = requirePrincipal(req);
  return { hotelId: BigInt(user.hotelId), actorId: BigInt(user.id), role: user.role };
}

export function employeeController(service: EmployeeService) {
  const createEmployee: RequestHandler = async (req, res) => {
    const { body } = res.locals.validated as { body: CreateEmployeeInput };
    const result = await service.createEmployee(scope(req), body);
    res.status(201).json({
      success: true,
      message: 'Employee created',
      data: result,
    });
  };

  const getEmployees: RequestHandler = async (req, res) => {
    const { query } = res.locals.validated as { query: EmployeeQuery };
    res.json({
      success: true,
      message: 'Employees retrieved',
      data: await service.getEmployees(scope(req), query),
    });
  };

  const updateEmployee: RequestHandler = async (req, res) => {
    const { params, body } = res.locals.validated as {
      params: { id: string };
      body: UpdateEmployeeInput;
    };
    const result = await service.updateEmployee(scope(req), BigInt(params.id), body);
    res.json({
      success: true,
      message: 'Employee updated',
      data: result,
    });
  };

  const deactivateEmployee: RequestHandler = async (req, res) => {
    const { params } = res.locals.validated as { params: { id: string } };
    const result = await service.deactivateEmployee(scope(req), BigInt(params.id));
    res.json({
      success: true,
      message: 'Employee deactivated',
      data: result,
    });
  };

  return { createEmployee, getEmployees, updateEmployee, deactivateEmployee };
}
