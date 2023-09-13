import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { Response } from 'express';
import { CredentialsService } from 'src/services/credentials/credentials.service';
import { SbrcService } from 'src/services/sbrc/sbrc.service';
import { TelemetryService } from 'src/services/telemetry/telemetry.service';
import { AadharService } from 'src/services/aadhar/aadhar.service';
import { KeycloakService } from 'src/services/keycloak/keycloak.service';
import jwt_decode from 'jwt-decode';
//import { UsersService } from 'src/services/users/users.service';
const { Readable } = require('stream');

@Injectable()
export class BulkIssuanceService {
  constructor(
    private credService: CredentialsService,
    private sbrcService: SbrcService,
    private telemetryService: TelemetryService,
    private aadharService: AadharService,
    private keycloakService: KeycloakService,
    private readonly httpService: HttpService, //private usersService: UsersService,
  ) {}

  fs = require('fs');
  parse = require('csv-parse');
  async = require('async');
  papa = require('papaparse');

  //credentials
  //getCredentialIssue
  async getCredentialIssue(postrequest: any, response: Response) {
    if (
      postrequest?.schema_id &&
      postrequest?.issuerDetail?.did &&
      postrequest?.vcData &&
      postrequest?.credentialSubject
    ) {
      const getschema = await this.credService.generateSchema(
        postrequest?.schema_id,
      );
      if (!getschema) {
        return response.status(400).send({
          success: false,
          status: 'get_schema_error',
          message: 'Get Schema Failed or Schema Not Found ! Please Try Again.',
          result: null,
        });
      } else {
        if (getschema?.schema?.required) {
          //all fields
          let schema_fields = getschema?.schema?.properties;
          let all_schema_properties_fields = Object.keys(schema_fields);
          //required_fileds
          let required_fileds = getschema?.schema?.required;
          let invite_fileds = [];
          let learner_schema_field =
            process.env.LEARNER_SCHEMA_FIELD.split(' ');
          for (let i = 0; i < learner_schema_field.length; i++) {
            invite_fileds.push(learner_schema_field[i]);
          }
          let all_imp_fields = required_fileds;
          for (let i = 0; i < learner_schema_field.length; i++) {
            if (!all_imp_fields.includes(learner_schema_field[i])) {
              all_imp_fields.push(learner_schema_field[i]);
            }
          }
          //register bulk student
          let credentialPlayload = postrequest;
          let schemaId = postrequest?.schema_id;
          console.log('credentialPlayload: ', credentialPlayload);
          console.log('schemaId: ', schemaId);

          var issuerId = credentialPlayload.issuerDetail.did;

          //generate schema
          var schemaRes = getschema;
          console.log('schemaRes', schemaRes);

          if (schemaRes) {
            //error log report
            let iserror = false;
            let loglist = [];
            let error_count = 0;
            let success_count = 0;
            let i_count = 0;

            var responseArray = [];

            // bulk import
            for (const iterator of credentialPlayload.credentialSubject) {
              loglist[i_count] = {};
              loglist[i_count].studentDetails = iterator;

              try {
                //check iterator present all required field or not
                let valid_data = true;
                let not_found = '';
                //check validation
                let allfields = Object.keys(iterator);
                for (let i = 0; i < all_imp_fields.length; i++) {
                  let found = false;
                  for (let j = 0; j < allfields.length; j++) {
                    if (all_imp_fields[i] === allfields[j]) {
                      found = true;
                      break;
                    }
                  }
                  if (!found) {
                    not_found = all_imp_fields[i];
                    valid_data = false;
                  }
                }
                //check validation
                if (valid_data) {
                  console.log(
                    'all_schema_properties_fields',
                    all_schema_properties_fields,
                  );
                  console.log('iterator', iterator);
                  let new_iterator = {};
                  for (
                    let i = 0;
                    i < all_schema_properties_fields.length;
                    i++
                  ) {
                    if (iterator[all_schema_properties_fields[i]]) {
                      new_iterator[all_schema_properties_fields[i]] =
                        iterator[all_schema_properties_fields[i]];
                    }
                  }
                  console.log('new_iterator', new_iterator);
                  //generate did or find did
                  var name = iterator.student_name;
                  var dob = iterator.dob;
                  var gender = iterator.gender;

                  // find student
                  let searchSchema = {
                    filters: {
                      name: {
                        eq: name,
                      },
                      dob: {
                        eq: dob,
                      },
                      gender: {
                        eq: gender,
                      },
                    },
                  };
                  const studentDetails = await this.sbrcService.sbrcSearch(
                    searchSchema,
                    'Learner',
                  );
                  console.log('Learner Details', studentDetails);
                  if (
                    typeof studentDetails !== 'undefined' &&
                    studentDetails !== null
                  ) {
                    if (studentDetails.length > 0) {
                      if (studentDetails[0]?.did) {
                        new_iterator['id'] = studentDetails[0].did;
                        let obj = {
                          issuerId: issuerId,
                          credSchema: schemaRes,
                          credentialSubject: new_iterator,
                          issuanceDate: credentialPlayload.vcData.issuanceDate,
                          expirationDate:
                            credentialPlayload.vcData.expirationDate,
                        };
                        console.log('obj', obj);

                        const cred = await this.credService.issueCredentials(
                          obj,
                        );
                        //console.log("cred 34", cred)
                        if (cred) {
                          responseArray.push(cred);
                          loglist[i_count].status = true;
                          loglist[i_count].error = {};
                          success_count++;
                        } else {
                          responseArray.push({
                            error: 'unable to issue credentials!',
                          });
                          iserror = true;
                          loglist[i_count].status = false;
                          loglist[i_count].error =
                            'Unable to Issue Credentials ! Please Try Again.';
                          //loglist[i_count].errorlog = {};
                          error_count++;
                        }
                      } else {
                        let didRes = await this.credService.generateDid(
                          name + dob + gender,
                        );
                        console.log('did', didRes);
                        if (didRes) {
                          new_iterator['id'] =
                            didRes[0].verificationMethod[0].controller;
                          let updateRes = await this.sbrcService.sbrcUpdate(
                            {
                              did: new_iterator['id'],
                            },
                            'Learner',
                            studentDetails[0].osid,
                          );
                          if (updateRes) {
                            let obj = {
                              issuerId: issuerId,
                              credSchema: schemaRes,
                              credentialSubject: new_iterator,
                              issuanceDate:
                                credentialPlayload.vcData.issuanceDate,
                              expirationDate:
                                credentialPlayload.vcData.expirationDate,
                            };
                            console.log('obj', obj);

                            if (new_iterator['id']) {
                              const cred =
                                await this.credService.issueCredentials(obj);
                              //console.log("cred 34", cred)
                              if (cred) {
                                responseArray.push(cred);
                                loglist[i_count].status = true;
                                loglist[i_count].error = {};
                                success_count++;
                              } else {
                                responseArray.push({
                                  error: 'unable to issue credentials!',
                                });
                                iserror = true;
                                loglist[i_count].status = false;
                                loglist[i_count].error =
                                  'Unable to Issue Credentials ! Please Try Again.';
                                //loglist[i_count].errorlog = {};
                                error_count++;
                              }
                            }
                          } else {
                            responseArray.push({
                              error: 'unable to update did inside RC!',
                            });
                            iserror = true;
                            loglist[i_count].status = false;
                            loglist[i_count].error =
                              'Unable to Update Student Identity ! Please Try Again.';
                            //loglist[i_count].errorlog = {};
                            error_count++;
                          }
                        } else {
                          responseArray.push({
                            error: 'unable to generate student did!',
                          });
                          iserror = true;
                          loglist[i_count].status = false;
                          loglist[i_count].error =
                            'Unable to Generate Student DID ! Please Try Again.';
                          //loglist[i_count].errorlog = {};
                          error_count++;
                        }
                      }
                    } else {
                      let didRes = await this.credService.generateDid(
                        name + dob + gender,
                      );

                      if (didRes) {
                        new_iterator['id'] =
                          didRes[0].verificationMethod[0].controller;
                        let inviteSchema = {
                          name: iterator['student_name'],
                          dob: iterator['dob'],
                          gender: iterator['gender'],
                          did: new_iterator['id'],
                          username: '',
                          aadhaar_token: '',
                          kyc_aadhaar_token: '',
                          recoveryphone: '',
                        };
                        console.log('inviteSchema', inviteSchema);
                        let createStudent = await this.sbrcService.sbrcInvite(
                          inviteSchema,
                          'Learner',
                        );
                        console.log('createStudent', createStudent);

                        if (createStudent) {
                          let obj = {
                            issuerId: issuerId,
                            credSchema: schemaRes,
                            credentialSubject: new_iterator,
                            issuanceDate:
                              credentialPlayload.vcData.issuanceDate,
                            expirationDate:
                              credentialPlayload.vcData.expirationDate,
                          };
                          console.log('obj', obj);

                          const cred = await this.credService.issueCredentials(
                            obj,
                          );
                          //console.log("cred 34", cred)
                          if (cred) {
                            responseArray.push(cred);
                            loglist[i_count].status = true;
                            loglist[i_count].error = {};
                            success_count++;
                          } else {
                            responseArray.push({
                              error: 'unable to issue credentials!',
                            });
                            iserror = true;
                            loglist[i_count].status = false;
                            loglist[i_count].error =
                              'Unable to Issue Credentials ! Please Try Again.';
                            //loglist[i_count].errorlog = {};
                            error_count++;
                          }
                        } else {
                          responseArray.push({
                            error: 'unable to create student in RC!',
                          });
                          iserror = true;
                          loglist[i_count].status = false;
                          loglist[i_count].error =
                            'Unable to Create Student Account ! Please Try Again.';
                          //loglist[i_count].errorlog = {};
                          error_count++;
                        }
                      } else {
                        responseArray.push({
                          error: 'unable to generate student did!',
                        });
                        iserror = true;
                        loglist[i_count].status = false;
                        loglist[i_count].error =
                          'Unable to Generate Student DID ! Please Try Again.';
                        //loglist[i_count].errorlog = {};
                        error_count++;
                      }
                    }
                  } else {
                    responseArray.push({
                      error: 'unable to search student in RC!',
                    });
                    iserror = true;
                    loglist[i_count].status = false;
                    loglist[i_count].error =
                      'Unable to Search Student Account ! Please Try Again.';
                    //loglist[i_count].errorlog = {};
                    error_count++;
                  }
                } else {
                  responseArray.push({
                    error: 'not received schema required fields: ' + not_found,
                  });
                  iserror = true;
                  loglist[i_count].status = false;
                  loglist[i_count].error =
                    'not received schema required fields: ' + not_found;
                  //loglist[i_count].errorlog = {};
                  error_count++;
                }
              } catch (e) {
                console.log(e);
                iserror = true;
                loglist[i_count].status = false;
                loglist[i_count].error = 'System Exception ! Please Try Again.';
                loglist[i_count].errorlog = JSON.stringify(e);
                error_count++;
              }
              i_count++;
            }

            return response.status(200).send({
              success: true,
              status: 'student_bulk_upload_api_success',
              iserror: iserror,
              message: 'Student Bulk Upload API Success.',
              error_count: error_count,
              success_count: success_count,
              result: loglist,
            });
          } else {
            return response.status(200).send({
              success: false,
              status: 'did_cred_generate_error',
              message:
                'User Identity and Credentials Generation Failed. Schema Not Found. Try Again.',
              result: null,
            });
          }
        } else {
          return response.status(400).send({
            success: false,
            status: 'get_schema_error',
            message: 'Get Schema Required Failed ! Please Try Again.',
            result: null,
          });
        }
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //helper function
  //get jwt token information
  parseJwt = async (token): Promise<any> => {
    if (!token) {
      return {};
    }
    const decoded = jwt_decode(token);
    return decoded;
  };
}
