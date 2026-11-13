# NextTurn

A multi-tenant queue management and appointment booking platform uniting advance reservations and walk-in reception for service businesses.

## Language

### Platform & Tenancy

**Platform**:
A deployed NextTurn instance owned and operated by the Platform Owner.
_Avoid_: System, App

**Platform Owner**:
The organization that owns and commissions the Platform.
_Avoid_: Customer (as acquirer), Sponsor, Client

**Platform Administrator**:
Platform Owner personnel responsible for approving, configuring, and monitoring Tenants across the Platform.
_Avoid_: SuperAdmin, System Admin

**Business**:
A service organization using the Platform to manage customer appointments and walk-in queues.
_Avoid_: Company, Merchant, Store

**Tenant**:
An isolated operational workspace representing a single Business on the Platform, currently mapped one-to-one with a Business.
_Avoid_: Organization, Workspace, Account

### Tenant Personnel

**Tenant Administrator**:
Business personnel with full administrative authority over a Tenant's services, staff, shift schedules, counters, and settings.
_Avoid_: Business Owner, Org Admin

**Tenant Staff**:
Business personnel assigned within a Tenant, encompassing both Counter Staff and Service Staff.
_Avoid_: Employee, Worker

**Counter Staff**:
Tenant Staff who operate reception Counters to check in Booking Customers, issue or advance Queue Tickets, and serve End-users.
_Avoid_: Receptionist, Desk Agent

**Service Staff**:
Rostered Tenant Staff assigned to Services in Shift Schedules strictly as an internal scheduling resource without Platform login or customer-facing selection.
_Avoid_: Specialist, Provider, Doctor

**Counter**:
A physical reception station configured for specific Services and claimed by Counter Staff during active service operations.
_Avoid_: Desk, Window, Booth

### End-users & Customers

**Customer**:
A person visiting or reserving Services at a Business, encompassing both Walk-in Customers and Booking Customers.
_Avoid_: Client, Patron, Guest

**End-user**:
Collective term for Walk-in Customers and Booking Customers interacting with a Tenant's customer-facing booking and queue experiences.
_Avoid_: Consumer, Visitor

**Walk-in Customer**:
A Customer who joins a live Service Queue on-site or online without a prior Appointment.
_Avoid_: Walk-in, Unscheduled Visitor

**Booking Customer**:
A Customer who reserves a Service Time Slot in advance via an Appointment.
_Avoid_: Booking User, Appointee

### Services, Scheduling & Queuing

**Service**:
A defined offering provided by a Business with a standard duration and price, acting as the pooled unit of Time Slot capacity and live queuing.
_Avoid_: Offering, Procedure

**Shift Schedule**:
A Tenant's configurable work-assignment matrix pivoting across staff, services, dates or hours, and Counters to allocate staffing capacity.
_Avoid_: Roster, Timetable

**Time Slot**:
A discrete bookable time window matching a Service's standard duration, whose capacity reflects active staff scheduled to cover it.
_Avoid_: Slot, Window

**Appointment**:
A confirmed advance reservation for a specific Service and Time Slot held by a Booking Customer prior to queue check-in.
_Avoid_: Booking, Reservation

**Queue**:
An ordered waiting stream scoped per Service that ingests both Walk-in Customers and checked-in Booking Customers.
_Avoid_: Line, Waitlist

**Queue Ticket**:
A numbered turn issued to an End-user in a Service Queue, progressing through waiting, calling, serving, hold, skip, transfer, completed, and no-show states.
_Avoid_: Token, Number, Slip
