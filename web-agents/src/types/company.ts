//Only thing that goes into the types folder are the shapes/structures of data --> In this case its the compnay structure

export interface Company {
    id: string;
    name: string;
    billingEmail: string | null;
    createdAt: Date;
    updatedAt: Date;
    users?: User[];
}

//A user MUST have these properties
export interface User {
    id: string;
    name: string | null;
    email: string | null;
    emailVerified: Date | null;
    image: string | null;
    role: string;
    source: string;
    companyId: string | null;
    createdAt: Date;
    updatedAt: Date;
    company?: Company | null;
}

//Data that is sent to the server to create a new company --> requires the name of the company!
export interface CompanyFormData {
    name: string;
    billingEmail?: string;
}

//Data that is sent to the server to update a company --> can update the name or billing email
export interface CompanyUpdateData {
    name?: string;
    billingEmail?: string;
}

export interface AssignUserToCompanyData {
    companyId: string;
}



















