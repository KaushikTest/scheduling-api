class Profile {
    constructor(id, company_name, time_zone, location, email, phone, created_at, updated_at) {
        this.id = id;
        this.company_name = company_name;
        this.time_zone = time_zone;
        this.location = location;
        this.email = email;
        this.phone = phone;
        this.created_at = created_at;
        this.updated_at = updated_at;
    }
}

class ProfileBuilder {
    constructor() { }

    setId(id) {
        this.id = id;
        return this;
    }

    setCompanyName(company_name) {
        this.company_name = company_name;
        return this;
    }

    setTimezone(timezone) {
        this.timezone = timezone;
        return this;
    }

    setLocation(location) {
        this.location = location;
        return this;
    }

    setEmail(email) {
        this.email = email;
        return this;
    }

    setPhone(phone) {
        this.phone = phone;
        return this;
    }

    setCreatedAt(created_at) {
        this.created_at = created_at;
        return this;
    }

    setUpdatedAt(updated_at) {
        this.updated_at = updated_at;
        return this;
    }

    build() {
        return new Profile(this.id, this.company_name, this.timezone, this.location, this.email, this.phone, this.created_at, this.updated_at)
    }
}

export { ProfileBuilder };